import dotenv from 'dotenv';
import { JsonRpcProvider, ethers } from 'ethers';
import kleur from 'kleur';
import fs from 'fs';
import moment from 'moment-timezone';
import fetch from 'node-fetch';
import chalk from 'chalk';
import readline from 'readline';

dotenv.config();

// RPC Providers
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

// Explorer base URL
const baseExplorerUrl = 'https://testnet-explorer.saharalabs.ai';

// Explorer URLs
const explorer = {
  get tx() {
    return (txHash) => `${baseExplorerUrl}/tx/${txHash}`;
  },
  get address() {
    return (address) => `${baseExplorerUrl}/address/${address}`;
  }
};

// Log helper
function appendLog(message) {
  fs.appendFileSync('log-sahara.txt', message + '\n');
}

// Function to generate random transaction value
function getRandomTransactionValue() {
  const min = 0.000001;  // Minimum value for transaction
  const max = 0.00001;   // Maximum value for transaction
  return Math.random() * (max - min) + min;
}

// Function to generate a random Ethereum address
function generateRandomAddress() {
  const randomPrivateKey = ethers.Wallet.createRandom().privateKey;
  const wallet = new ethers.Wallet(randomPrivateKey);
  return wallet.address;
}

// Function to add delay between transactions
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to read private keys
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
            console.log(chalk.yellow("\nPlease ensure your privatekeys.txt file:"));
            console.log(chalk.yellow("1. Contains one private key per line"));
            console.log(chalk.yellow("2. Each key is 64 hexadecimal characters"));
            console.log(chalk.yellow("3. No '0x' prefix needed"));
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

// Function to complete tasks
async function completeTasks(wallet) {
    try {
        console.log(chalk.blue(`\n🎯 Completing tasks for wallet: ${wallet.address}`));
        
        // First get access token
        const { accessToken } = await signChallenge(wallet);
        if (!accessToken) {
            throw new Error(`❌ Access token not found!`);
        }

        // Get user info to display shard amount
        await getUserInfo(accessToken, wallet.address);

        const taskID = "1004";  // Only task 1004
        const taskStatus = await sendCheckTask(accessToken, taskID, wallet.address);
        
        if (taskStatus.completed && taskStatus.status !== "3") {
            console.log(chalk.green("✅ Task completed successfully."));
        }
        
        return true;
    } catch (error) {
        console.log(chalk.red(`❌ Error completing tasks: ${error.message}`));
        return false;
    }
}

// Function to get user info
async function getUserInfo(accessToken, address) {
    console.log(chalk.blue("🔹 Fetching user info..."));
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
    const logMessage = `[${timestamp} | ${maskedAddress(address)}] 💎 Shard Amount: ${data.shardAmount}`;
    console.log(chalk.magentaBright(logMessage));
    return data;
}

// Function to check and claim task
async function sendCheckTask(accessToken, taskID, address) {
    console.log(chalk.blue(`🔹 Checking Task ${taskID} status...`));
    await delay(5000);

    // First flush the task
    if (taskID === "1004") {
        console.log(chalk.blue(`🔄 Flushing Task ${taskID}...`));
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
                console.log(chalk.yellow(`🔄 One Transaction Featching....`));
            } else if (flushData === 4) {
                console.log(chalk.yellow(`✅ Task ${taskID} already claimed.`));
                return {
                    completed: true,
                    progress: 100,
                    requiredProgress: 100,
                    status: "3"
                };
            } else {
                console.log(chalk.green(`🔄 Flush Response: ${JSON.stringify(flushData)}`));
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
            console.log(chalk.green(`🔹 Task ${taskID} is ready to claim...`));
            await sendTaskClaim(accessToken, taskID, address);
            taskCompleted = true;
        } else {
            console.log(chalk.yellow(`⚠️ One Transaction`));
        }
    } else if (status === "2") {
        console.log(chalk.green(`🔹 Task ${taskID} is claimable, claiming reward...`));
        await sendTaskClaim(accessToken, taskID, address);
        taskCompleted = true;
    } else if (status === "3") {
        console.log(chalk.yellow(`✅ Task ${taskID} already claimed.`));
        taskCompleted = true;
    } else {
        console.log(chalk.yellow(`⚠️ One Transaction`));
    }

    return {
        completed: taskCompleted,
        progress: progress,
        requiredProgress: requiredProgress,
        status: status
    };
}

// Function to claim task
async function sendTaskClaim(accessToken, taskID, address) {
    console.log(chalk.blue(`🔹 Claiming Task ${taskID}...`));
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
        throw new Error(`❌ Task claim failed: ${JSON.stringify(responseData)}`);
    }

    if (responseData.success) {
        console.log(chalk.green(`✅ Task ${taskID} - Successfully claimed.`));
    }
}

// Function to process all wallets
async function processAllWallets(privateKeys) {
    console.log(chalk.cyan(`\n🌍 Processing ${privateKeys.length} wallets...`));
    
    // First phase: Complete all transactions
    console.log(chalk.yellow('\n📦 Phase 1: Processing Transactions'));
    console.log(chalk.yellow('==============================='));
    
    for (let i = 0; i < privateKeys.length; i++) {
        const wallet = new ethers.Wallet(privateKeys[i], provider());
        console.log(chalk.cyan(`\nWallet [${i + 1}/${privateKeys.length}]`));
        console.log(chalk.yellow(`Transaction [${i + 1}/${privateKeys.length}]`));
        
        const txSuccess = await processWallet(wallet);
        
        if (!txSuccess) {
            console.log(chalk.red(`❌ Transaction failed for wallet ${i + 1}`));
        }
        
        // Add delay between wallets
        if (i < privateKeys.length - 1) {
            await delay(5000);
        }
    }
    
    // Second phase: Complete all tasks
    console.log(chalk.yellow('\n🎯 Phase 2: Completing Tasks'));
    console.log(chalk.yellow('========================='));
    
    for (let i = 0; i < privateKeys.length; i++) {
        const wallet = new ethers.Wallet(privateKeys[i], provider());
        console.log(chalk.cyan(`\nWallet [${i + 1}/${privateKeys.length}]`));
        
        const taskSuccess = await completeTasks(wallet);
        
        if (!taskSuccess) {
            console.log(chalk.red(`❌ Tasks failed for wallet ${i + 1}`));
        }
        
        // Add delay between wallets
        if (i < privateKeys.length - 1) {
            await delay(5000);
        }
    }
    
    console.log(chalk.green("\n🎉 All processes completed!"));
}

// Main function
async function main(isSingleTransaction = false, wallet = null, skipTasks = false) {
    try {
        if (isSingleTransaction) {
            if (wallet) {
                // Use the provided wallet
                const txSuccess = await processWallet(wallet);
                if (txSuccess && !skipTasks) {
                    await completeTasks(wallet);
                }
                return txSuccess;
            } else {
                // Get the first private key for single transaction
                const privateKeys = readPrivateKeys();
                if (privateKeys.length === 0) return false;
                
                const wallet = new ethers.Wallet(privateKeys[0], provider());
                const txSuccess = await processWallet(wallet);
                if (txSuccess && !skipTasks) {
                    await completeTasks(wallet);
                }
                return txSuccess;
            }
        } else {
            // Show menu for multiple transactions
            console.log(chalk.cyan('\n=== MENU OPTIONS ==='));
            console.log('1. Daily Login');
            console.log('2. Shard Claim');
            console.log('3. Balance');
            console.log('4. Auto All');
            console.log('5. Exit');
            
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            rl.question('\n? Select an option: ', async (answer) => {
                rl.close();
                
                switch(answer) {
                    case '1':
                        console.log(chalk.cyan('🚀 Starting Daily Login Transaction...'));
                        const privateKeys = readPrivateKeys();
                        if (privateKeys.length === 0) return;
                        
                        const wallet = new ethers.Wallet(privateKeys[0], provider());
                        const txSuccess = await processWallet(wallet);
                        if (txSuccess) {
                            console.log(chalk.green('✅ Transaction completed successfully!'));
                        }
                        await waitForEnter();
                        break;
                    case '2':
                        console.log('Shard Claim functionality to be implemented');
                        await waitForEnter();
                        break;
                    case '3':
                        console.log('Balance functionality to be implemented');
                        await waitForEnter();
                        break;
                    case '4':
                        // Read private keys
                        const autoPrivateKeys = readPrivateKeys();
                        console.log(chalk.cyan(`🌍 Processing ${autoPrivateKeys.length} wallets...`));

                        // Process all wallets (transactions first, then tasks)
                        await processAllWallets(autoPrivateKeys);
                        await waitForEnter();
                        break;
                    case '5':
                        console.log(chalk.yellow('👋 Goodbye!'));
                        process.exit(0);
                        break;
                    default:
                        console.log(chalk.red('❌ Invalid option selected'));
                        await waitForEnter();
                        break;
                }
            });
        }
    } catch (error) {
        console.error(chalk.red("❌ Error in main process:"), error);
        return false;
    }
}

// Function to wait for Enter key
function waitForEnter() {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question('\nPress Enter to return to main menu...', () => {
            rl.close();
            resolve();
        });
    });
}

export default main;
