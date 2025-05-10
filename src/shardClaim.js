import fs from 'fs';
import fetch from 'node-fetch';
import { ethers, JsonRpcProvider } from 'ethers';
import axios from 'axios';
import moment from 'moment-timezone';
import path from 'path';
import chalk from 'chalk';

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
    red: chalk.red
};

function log(address, message, color = 'green') {
    const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
    const logMessage = address 
        ? `[${timestamp} | ${maskedAddress(address)}] ${message}`
        : "";
    const colorFn = colorMap[color] || chalk.yellow; // fallback to yellow
    console.log(colorFn(logMessage));
    logToFile(logMessage);
}

const maskedAddress = (address) => `${address.slice(0, 6)}...${address.slice(-4)}`;

// Function to get challenge from the API
async function getChallenge(address) {
    log(address, "🔹 Requesting challenge...");
    await delay(5000);

    const response = await fetch("https://legends.saharalabs.ai/api/v1/user/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, timestamp: Date.now() })
    });

    if (!response.ok) {
        throw new Error(`❌ Failed to get challenge: ${response.statusText}`);
    }

    const data = await response.json();
    log(address, `✅ Challenge received: ${data.challenge}`);
    return data.challenge;
}

// Function to sign the challenge
async function signChallenge(wallet) {
    try {
        const address = wallet.address;
        const challenge = await getChallenge(address);
        const message = `Sign in to Sahara!\nChallenge:${challenge}`;
        const signature = await wallet.signMessage(message);

        log(address, `✅ Signature: ${signature.slice(0, 6)}...${signature.slice(-4)}`);

        log(address, "🔹 Submitting signature for login...");
        await delay(5000);
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
        const maskedToken = loginData.accessToken
            ? `${loginData.accessToken.slice(0, 6)}***${loginData.accessToken.slice(-4)}`
            : "Token not found";

        log(address, `✅ Login successful! Access Token: ${maskedToken}`);

        if (!loginData.accessToken) {
            throw new Error(`❌ Failed to retrieve accessToken`);
        }

        return { accessToken: loginData.accessToken };
    } catch (error) {
        log(wallet.address, `❌ Error during login: ${error.message}`);
        throw error;
    }
}

// Main task function for checking and claiming task 1004
async function sendTaskClaim(accessToken, taskID, address) {
    log(address, `🔹 Claiming Task ${taskID}...`);
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
        throw new Error(`❌ Claim failed: ${response.statusText} - ${JSON.stringify(responseData)}`);
    }

    if (responseData.success) {
        log(address, `✅ Task ${taskID} - Successfully claimed.`);
    } else {
        throw new Error(`❌ Claim failed: ${responseData.message || 'Unknown error'}`);
    }
}

async function sendCheckTask(accessToken, taskID, address) {
    log(address, `🔹 Checking Task ${taskID} status...`, 'blue');
    await delay(5000);

    // First flush the task
    if (taskID === "1004") {
        log(address, `🔄 Flushing Task ${taskID}...`, 'blue');
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
                log(address, `🔄 One Transaction`, 'yellow');
            } else if (flushData === 4) {
                log(address, `✅ Task ${taskID} already claimed.`, 'yellow');
                return {
                    completed: true,
                    progress: 100,
                    requiredProgress: 100,
                    status: "3"
                };
            } else {
                log(address, `🔄 Flush Response: ${JSON.stringify(flushData)}`, 'green');
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
            log(address, `🔹 Task ${taskID} is ready to claim...`, 'green');
            await sendTaskClaim(accessToken, taskID, address);
            taskCompleted = true;
        } else {
            log(address, `⚠️ One Transaction`, 'yellow');
        }
    } else if (status === "2") {
        log(address, `🔹 Task ${taskID} is claimable, claiming reward...`, 'green');
        await sendTaskClaim(accessToken, taskID, address);
        taskCompleted = true;
    } else if (status === "3") {
        log(address, `✅ Task ${taskID} already claimed.`, 'yellow');
        taskCompleted = true;
    } else {
        log(address, `⚠️ One Transaction`, 'yellow');
    }

    return {
        completed: taskCompleted,
        progress: progress,
        requiredProgress: requiredProgress,
        status: status
    };
}

async function sendDailyTask(wallet, index, total) {
    try {
        log(wallet.address, `🔹 Processing wallet: ${wallet.address} [ ${index + 1}/${total} ]`);
        const { accessToken } = await signChallenge(wallet);
        if (!accessToken) {
            throw new Error(`❌ Access token not found!`);
        }

        const taskID = "1004";  // Only task 1004
        const taskStatus = await sendCheckTask(accessToken, taskID, wallet.address);
        
        if (taskStatus.completed && taskStatus.status !== "3") {
            log(wallet.address, "✅ Task completed successfully.");
        }
        log("", "");
    } catch (error) {
        log(wallet.address, `❌ Error: ${error.message}`);
    }
}

// Start bot with private keys
async function startBot() {
    fs.writeFileSync(logFile, "");
    const privateKeys = fs.readFileSync('privatekeys.txt', 'utf-8').split('\n').map(line => line.trim()).filter(Boolean);
    const totalWallets = privateKeys.length;

    for (let i = 0; i < privateKeys.length; i++) {
        const wallet = new ethers.Wallet(privateKeys[i]);
        log("", `🔹 Processing wallet: ${wallet.address} [ ${i + 1}/${totalWallets} ]`);
        
        // Process one wallet at a time
        await sendDailyTask(wallet, i, totalWallets);
        
        // Add a small delay between wallets
        await delay(5000);
    }
}

export default startBot;
