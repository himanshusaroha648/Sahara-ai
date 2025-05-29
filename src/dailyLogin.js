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
  const randomPrivateKey = ethers.Wallet.createRandom().privateKey; // Generate a random private key
  const wallet = new ethers.Wallet(randomPrivateKey);
  return wallet.address;  // Return the generated address
}

// Function to add delay between transactions
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to read private keys
function readPrivateKeys() {
    return fs.readFileSync('privatekeys.txt', 'utf-8')
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);
}

// Function to process a single wallet
async function processWallet(wallet, index, total) {
    try {
        console.log(chalk.blue(`🚀 Start Transaction for Wallet ${wallet.address}...`));
        
        // Get the current timestamp
        const timestamp = moment().tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss');
        
        // Get current gas price and add buffer
        const feeData = await provider().getFeeData();
        const maxFeePerGas = feeData.maxFeePerGas ? feeData.maxFeePerGas * 20n : ethers.parseUnits("200", "gwei");
        const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ? feeData.maxPriorityFeePerGas * 20n : ethers.parseUnits("50", "gwei");
        
        // Create transaction
        const tx = {
            to: "0x310f9f43998e8a71a75ec180ac2ffa2be204af91", // Always send to this address
            value: ethers.parseEther("0"), // 0 ETH
            data: "0x", // Empty data
            gasLimit: 21000, // Standard gas limit for simple transfers
            maxFeePerGas: maxFeePerGas,
            maxPriorityFeePerGas: maxPriorityFeePerGas,
            type: 2 // EIP-1559 transaction type
        };

        console.log(chalk.yellow(`Gas Price - Max Fee: ${ethers.formatUnits(maxFeePerGas, "gwei")} gwei, Priority Fee: ${ethers.formatUnits(maxPriorityFeePerGas, "gwei")} gwei`));

        // Send transaction
        const transaction = await wallet.sendTransaction(tx);
        console.log(chalk.green(`✅ [${timestamp}] Transaction sent for ${wallet.address}`));
        
        // Wait for transaction to be mined
        const receipt = await transaction.wait();
        console.log(chalk.green(`✅ [${timestamp}] Transaction confirmed for ${wallet.address}`));
        
        return true;
    } catch (error) {
        if (error.message.includes('insufficient funds')) {
            console.log(chalk.magenta(`insufficient funds`));
            // Get and display balance
            try {
                const balance = await provider().getBalance(wallet.address);
                const balanceInEth = ethers.formatEther(balance);
                console.log(chalk.yellow(`Balance: ${balanceInEth} ETH`));
            } catch (balanceError) {
                // Ignore balance error
            }
        } else {
            const timestamp = moment().tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss');
            console.log(chalk.red(`❌ [${timestamp}] Error processing wallet: ${error.message}`));
        }
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

// Function to perform auto all operations
async function performAutoAll() {
    try {
        console.log(chalk.cyan('🚀 Starting Auto All Process...'));
        
        // Step 1: Perform one transaction
        console.log(chalk.yellow('📝 Step 1: Performing transaction...'));
        const privateKeys = readPrivateKeys();
        if (privateKeys.length > 0) {
            const wallet = new ethers.Wallet(privateKeys[0], provider());
            await processWallet(wallet, 0, 1);
        }
        
        // Step 2: Perform login
        console.log(chalk.yellow('🔑 Step 2: Performing login...'));
        // TODO: Add login functionality here
        
        // Step 3: Complete tasks
        console.log(chalk.yellow('✅ Step 3: Completing tasks...'));
        // TODO: Add task completion functionality here
        
        console.log(chalk.green('🎉 Auto All process completed successfully!'));
        await waitForEnter();
    } catch (error) {
        console.error(chalk.red('❌ Error in Auto All process:'), error);
        await waitForEnter();
    }
}

// Main function
async function main(singleTransaction = false) {
    try {
        if (!singleTransaction) {
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
                        // Original daily login functionality
                        const privateKeys = readPrivateKeys();
                        console.log(chalk.cyan(`🌍 Detected ${privateKeys.length} wallets in privatekeys.txt.`));
                        await processAllWallets(privateKeys);
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
                        await performAutoAll();
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
        } else {
            // Single transaction mode for Auto All
            console.log(chalk.cyan('🌍 Sahara Network Login Script'));
            console.log('===========================');
            
            const privateKeys = readPrivateKeys();
            console.log(chalk.cyan(`📊 Found ${privateKeys.length} wallets\n`));
            
            if (privateKeys.length > 0) {
                console.log(chalk.yellow('📦 Processing wallet 1 of 1'));
                const wallet = new ethers.Wallet(privateKeys[0], provider());
                const success = await processWallet(wallet, 0, 1);
                
                if (success) {
                    console.log(chalk.green('✅ Transaction completed successfully'));
                    return true;
                } else {
                    console.log(chalk.red('❌ Transaction failed'));
                    return false;
                }
            }
        }
    } catch (error) {
        console.error(chalk.red("❌ Error in main process:"), error);
        if (!singleTransaction) {
            await waitForEnter();
        }
        return false;
    }
}

// Helper function to process all wallets
async function processAllWallets(privateKeys) {
    // Process in batches of 1
    const batchSize = 1;
    const totalBatches = Math.ceil(privateKeys.length / batchSize);

    for (let i = 0; i < privateKeys.length; i += batchSize) {
        const batchNumber = Math.floor(i / batchSize) + 1;
        console.log(chalk.yellow(`📦 Processing Batch ${batchNumber} of ${totalBatches}...`));

        const batch = privateKeys.slice(i, i + batchSize);
        const wallets = batch.map(privateKey => new ethers.Wallet(privateKey, provider()));

        // Process each wallet in the batch
        for (let j = 0; j < wallets.length; j++) {
            const wallet = wallets[j];
            await processWallet(wallet, i + j, privateKeys.length);
            await delay(2000); // Add delay between wallets
        }

        console.log(chalk.green(`✅ Batch ${batchNumber} completed.`));
        await delay(5000); // Add delay between batches
    }

    console.log(chalk.green("\n🎉 All transactions completed."));
    await waitForEnter();
}

export default main;
