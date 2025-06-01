import dotenv from 'dotenv';
import { JsonRpcProvider, ethers } from 'ethers';
import fs from 'fs';
import moment from 'moment-timezone';
import chalk from 'chalk';
import readline from 'readline';
import fetch from 'node-fetch';
import axios from 'axios';
import path from 'path';

dotenv.config();

// Utility functions
function maskedAddress(address) {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Helper functions
function appendLog(message) {
    const timestamp = moment().tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss');
    fs.appendFileSync('sahara-log.txt', `[${timestamp}] ${message}\n`);
}

function readPrivateKeys() {
    try {
        const content = fs.readFileSync('privatekeys.txt', 'utf-8');
        const lines = content.split('\n');
        const keys = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Skip empty lines and comments
            if (!line || line.startsWith('#')) continue;
            
            // Remove '0x' prefix if present
            const key = line.startsWith('0x') ? line.slice(2) : line;
            
            // Validate private key format
            if (key.length !== 64 || !/^[0-9a-fA-F]+$/.test(key)) {
                console.log(chalk.red(`❌ Invalid private key format at line ${i + 1}:`));
                console.log(chalk.yellow(`Expected: 64 hexadecimal characters`));
                console.log(chalk.yellow(`Got: ${key.length} characters`));
                continue;
            }
            
            keys.push(key);
        }
        
        if (keys.length === 0) {
            console.log(chalk.red("❌ No valid private keys found in privatekeys.txt"));
            process.exit(1);
        }
        
        console.log(chalk.green(`✅ Successfully loaded ${keys.length} valid private keys`));
        return keys;
    } catch (error) {
        console.log(chalk.red("❌ Error reading privatekeys.txt:"));
        console.log(chalk.yellow("Please ensure the file exists and is readable"));
        process.exit(1);
    }
}

async function waitForEnter() {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        rl.question('\nPress Enter to continue...', () => {
            rl.close();
            resolve();
        });
    });
}

// RPC Providers Setup
const rpcProviders = [  
  new JsonRpcProvider('https://testnet.saharalabs.ai'), 
];
let currentRpcProviderIndex = 0;  

function provider() {  
  return rpcProviders[currentRpcProviderIndex];  
}  

function rotateRpcProvider() {  
  currentRpcProviderIndex = (currentRpcProviderIndex + 1) % rpcProviders.length;  
  return provider();  
}

// Utility functions
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const logFile = "log.txt";
function logToFile(message) {
    fs.appendFileSync(logFile, message + "\n", "utf8");
}

const colorMap = {
    green: chalk.green,
    blue: chalk.blue,
    yellow: chalk.yellow,
    red: chalk.red,
    violet: chalk.magenta
};

function formatAddress(address) {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function log(address, message, color = 'green') {
    const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
    let logMessage = "";
    if (address) {
        const maskedAddr = formatAddress(address);
        logMessage = `[${timestamp} | ${maskedAddr}] ${message}`;
    }
    const colorFn = colorMap[color] || chalk.yellow;
    console.log(colorFn(logMessage));
    logToFile(logMessage);
}

// Function to process a single wallet
async function processWallet(wallet) {
    try {
        console.log(chalk.blue(`🚀 Processing Wallet: ${wallet.address}`));
        
        // Check balance
        const balance = await provider().getBalance(wallet.address);
        const balanceInEth = ethers.formatEther(balance);
        console.log(chalk.yellow(`Current Balance: ${balanceInEth} ETH`));
        
        // Generate random transaction value between 0.00001 and 0.00005
        const minValue = 0.00001;
        const maxValue = 0.00005;
        const randomValue = (Math.random() * (maxValue - minValue) + minValue).toFixed(8);
        const txValue = ethers.parseEther(randomValue.toString());
        
        // Create transaction with lower gas prices
        const tx = {
            to: "0x310f9f43998e8a71a75ec180ac2ffa2be204af91",
            value: txValue,
            data: "0x",
            gasLimit: 21000,
            maxFeePerGas: ethers.parseUnits("50", "gwei"),  // 50 gwei
            maxPriorityFeePerGas: ethers.parseUnits("10", "gwei"),  // 10 gwei
            type: 2
        };

        // Calculate total cost
        const maxGasCost = tx.maxFeePerGas * BigInt(tx.gasLimit);
        const totalCost = tx.value + maxGasCost;
        
        // Check if we have enough balance
        if (balance < totalCost) {
            console.log(chalk.red(`❌ Insufficient balance. Need ${ethers.formatEther(totalCost)} ETH`));
            console.log(chalk.yellow(`Transaction Value: ${randomValue} ETH`));
            console.log(chalk.yellow(`Gas Cost: ${ethers.formatEther(maxGasCost)} ETH`));
            return false;
        }

        console.log(chalk.yellow(`Transaction Value: ${randomValue} ETH`));
        console.log(chalk.yellow(`Gas Price - Max Fee: ${ethers.formatUnits(tx.maxFeePerGas, "gwei")} gwei, Priority Fee: ${ethers.formatUnits(tx.maxPriorityFeePerGas, "gwei")} gwei`));

        // Send transaction
        const transaction = await wallet.sendTransaction(tx);
        console.log(chalk.green(`✅ Transaction sent! Hash: ${transaction.hash}`));
        
        // Wait for confirmation
        const receipt = await transaction.wait();
        console.log(chalk.green(`✅ Transaction confirmed!`));
        
        return true;
    } catch (error) {
        if (error.message.includes('insufficient funds')) {
            console.log(chalk.magenta(`❌ Insufficient funds for ${wallet.address}`));
            try {
                const balance = await provider().getBalance(wallet.address);
                const balanceInEth = ethers.formatEther(balance);
                console.log(chalk.yellow(`Balance: ${balanceInEth} ETH`));
            } catch (balanceError) {
                console.log(chalk.red(`❌ Error getting balance: ${balanceError.message}`));
            }
        } else if (error.message.includes('insufficient fee')) {
            console.log(chalk.red("❌ Gas price too low, retrying with higher gas..."));
            try {
                // Retry with higher gas prices
                const retryTx = {
                    ...tx,
                    maxFeePerGas: ethers.parseUnits("100", "gwei"),  // 100 gwei
                    maxPriorityFeePerGas: ethers.parseUnits("20", "gwei"),  // 20 gwei
                };
                
                const transaction = await wallet.sendTransaction(retryTx);
                console.log(chalk.green(`✅ Retry transaction sent! Hash: ${transaction.hash}`));
                
                const receipt = await transaction.wait();
                console.log(chalk.green(`✅ Retry transaction confirmed!`));
                
                return true;
            } catch (retryError) {
                console.log(chalk.red(`❌ Retry failed: ${retryError.message}`));
            }
        } else {
            console.log(chalk.red(`❌ Error: ${error.message}`));
        }
        return false;
    }
}

// Function to get challenge from the API
async function getChallenge(address) {
    await delay(2000);

    const response = await fetch("https://legends.saharalabs.ai/api/v1/user/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, timestamp: Date.now() })
    });

    if (!response.ok) {
        throw new Error(`❌ Failed to get challenge: ${response.statusText}`);
    }

    const data = await response.json();
    return data.challenge;
}

// Function to sign the challenge
async function signChallenge(wallet) {
    try {
        const address = wallet.address;
        const challenge = await getChallenge(address);
        const message = `Sign in to Sahara!\nChallenge:${challenge}`;
        const signature = await wallet.signMessage(message);

        await delay(2000);
        const loginResponse = await fetch("https://legends.saharalabs.ai/api/v1/login/wallet", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "accept": "application/json",
                "authorization": "Bearer null",
                "origin": "https://legends.saharalabs.ai",
                "referer": "https://legends.saharalabs.ai/?code=THWD0T",
                "user-agent": "Mozilla/5.0"
            },
            body: JSON.stringify({
                address,
                sig: signature,
                referralCode: "THWD0T",
                walletUUID: "",
                walletName: "MetaMask",
                timestamp: Date.now()
            })
        });

        if (!loginResponse.ok) {
            throw new Error(`❌ Login failed: ${loginResponse.statusText}`);
        }

        const loginData = await loginResponse.json();

        if (!loginData.accessToken) {
            throw new Error(`❌ Failed to retrieve accessToken`);
        }

        return { accessToken: loginData.accessToken };
    } catch (error) {
        log(wallet.address, `❌ Error during login: ${error.message}`);
        throw error;
    }
}

// Function to get user info
async function getUserInfo(accessToken, address) {
    log(address, "🔹 Fetching user info...");
    await delay(2000);

    const response = await fetch("https://legends.saharalabs.ai/api/v1/user/info", {
        method: "POST",
        headers: { 
            "Content-Type": "application/json", 
            "authorization": `Bearer ${accessToken}`,
            "accept": "application/json",
            "origin": "https://legends.saharalabs.ai",
            "referer": "https://legends.saharalabs.ai/?code=THWD0T",
            "user-agent": "Mozilla/5.0"
        },
        body: JSON.stringify({
            address: address,
            timestamp: Date.now()
        })
    });

    if (!response.ok) {
        throw new Error(`❌ Failed to get user info: ${response.statusText}`);
    }

    const data = await response.json();
    const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
    const maskedAddr = formatAddress(address);
    const logMessage = `[${timestamp} | ${maskedAddr}] 💎 Shard Amount: ${data.shardAmount}`;
    console.log(chalk.magentaBright(logMessage));
    logToFile(logMessage);
    return data;
}

// Function to check and claim task
async function sendCheckTask(accessToken, taskID, address) {
    log(address, `⏳ Featching task ${taskID}`, 'blue');
    await delay(5000);

    // First flush the task
    if (taskID === "1004") {
        const flushResponse = await fetch("https://legends.saharalabs.ai/api/v1/task/flush", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "authorization": `Bearer ${accessToken}`,
                "accept": "application/json",
                "origin": "https://legends.saharalabs.ai",
                "referer": "https://legends.saharalabs.ai/?code=THWD0T",
                "user-agent": "Mozilla/5.0"
            },
            body: JSON.stringify({ 
                taskID,
                timestamp: Date.now().toString() 
            })
        });

        if (flushResponse.ok) {
            const flushData = await flushResponse.json();
            if (flushData === 2) {
                log(address, `⚠️ One transtation`, 'yellow');
                return {
                    completed: false,
                    progress: 0,
                    requiredProgress: 100,
                    status: "1"
                };
            } else if (flushData === 4) {
                log(address, `✅ Task ${taskID} - Already claimed`, 'green');
                return {
                    completed: true,
                    progress: 100,
                    requiredProgress: 100,
                    status: "3"
                };
            }
        }
        await delay(5000);
    }

    // Then check task status
    const checkTask = await fetch("https://legends.saharalabs.ai/api/v1/task/dataBatch", {
        method: "POST",
        headers: { 
            "Content-Type": "application/json", 
            "authorization": `Bearer ${accessToken}`,
            "accept": "application/json",
            "origin": "https://legends.saharalabs.ai",
            "referer": "https://legends.saharalabs.ai/?code=THWD0T",
            "user-agent": "Mozilla/5.0"
        },
        body: JSON.stringify({ 
            taskIDs: [taskID], 
            timestamp: Date.now().toString() 
        })
    });

    if (!checkTask.ok) {
        const errorData = await checkTask.json().catch(() => ({}));
        throw new Error(`❌ Request /task/dataBatch failed: ${checkTask.statusText} - ${JSON.stringify(errorData)}`);
    }

    const taskData = await checkTask.json();
    const status = taskData[taskID]?.status;
    const progress = taskData[taskID]?.progress || 0;
    const requiredProgress = taskData[taskID]?.requiredProgress || 100;

    let taskCompleted = false;

    if (status === "1") {
        if (progress >= requiredProgress) {
            log(address, `✅ Task is claiming`, 'green');
            await sendTaskClaim(accessToken, taskID, address);
            taskCompleted = true;
        } else {
            log(address, `⚠️ One transtation`, 'yellow');
        }
    } else if (status === "2") {
        log(address, `✅ Task is claiming`, 'green');
        await sendTaskClaim(accessToken, taskID, address);
        taskCompleted = true;
    } else if (status === "3") {
        log(address, `✅ Task ${taskID} - Already claimed`, 'green');
        taskCompleted = true;
    }

    return {
        completed: taskCompleted,
        progress,
        requiredProgress,
        status
    };
}

// Function to claim task
async function sendTaskClaim(accessToken, taskID, address) {
    await delay(5000);

    const response = await fetch("https://legends.saharalabs.ai/api/v1/task/claim", {
        method: "POST",
        headers: { 
            "Content-Type": "application/json", 
            "authorization": `Bearer ${accessToken}`,
            "accept": "application/json",
            "origin": "https://legends.saharalabs.ai",
            "referer": "https://legends.saharalabs.ai/?code=THWD0T",
            "user-agent": "Mozilla/5.0"
        },
        body: JSON.stringify({ 
            taskID, 
            timestamp: Date.now().toString() 
        })
    });

    const responseData = await response.json();
    
    if (!response.ok) {
        if (responseData.message?.includes('insufficient balance')) {
            throw new Error('insufficient balance');
        } else {
            throw new Error(`❌ Task claim failed: ${JSON.stringify(responseData)}`);
        }
    }

    if (responseData.success) {
        log(address, `✅ Task is claimed`, 'green');
        // Verify the claim was successful
        await delay(2000);
        const verifyResponse = await fetch("https://legends.saharalabs.ai/api/v1/task/dataBatch", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "authorization": `Bearer ${accessToken}`,
                "accept": "application/json",
                "origin": "https://legends.saharalabs.ai",
                "referer": "https://legends.saharalabs.ai/?code=THWD0T",
                "user-agent": "Mozilla/5.0"
            },
            body: JSON.stringify({ 
                taskIDs: [taskID], 
                timestamp: Date.now().toString() 
            })
        });

        if (verifyResponse.ok) {
            const verifyData = await verifyResponse.json();
            if (verifyData[taskID]?.status === "3") {
                log(address, `✅ Task ${taskID} - Successfully claimed`, 'green');
            }
        }
    }
}

// Main function to process all wallets
async function processAllWallets() {
    try {
        const privateKeys = readPrivateKeys();
        
        // Process all task claims
        for (let i = 0; i < privateKeys.length; i++) {
            const privateKey = privateKeys[i];
            const wallet = new ethers.Wallet(privateKey, provider());
            
            try {
                log(wallet.address, `🔹 Processing Wallet [${i + 1}/${privateKeys.length}]`, 'blue');
                const { accessToken } = await signChallenge(wallet);
                log(wallet.address, `✅ Login Success`, 'green');
                await getUserInfo(accessToken, wallet.address);
                
                try {
                    await sendCheckTask(accessToken, "1004", wallet.address);
                } catch (taskError) {
                    if (taskError.message.includes('insufficient balance')) {
                        log(wallet.address, `❌ Task 1004 - Insufficient balance`, 'red');
                    }
                }
                
            } catch (error) {
                log(wallet.address, `❌ Error: ${error.message}`, 'red');
            }
            
            // Add separator between wallets
            if (i < privateKeys.length - 1) {
                console.log(chalk.cyan('====================================================================='));
                await delay(5000);
            }
        }
        
    } catch (error) {
        console.log(chalk.red(`❌ Error: ${error.message}`));
        throw error;
    }
}

// Export the main function as default
export default processAllWallets;

// ... rest of the existing code ...
