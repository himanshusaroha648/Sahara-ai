import dotenv from 'dotenv';
import { JsonRpcProvider, ethers } from 'ethers';
import kleur from 'kleur';
import fs from 'fs';
import moment from 'moment-timezone';
import chalk from 'chalk';

dotenv.config();

// RPC Providers
const rpcProviders = [
    new JsonRpcProvider('https://testnet.saharalabs.ai'),  // Sahara Testnet RPC
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

// Function to read private keys from the file
function readPrivateKeys() {
    return fs.readFileSync('privatekeys.txt', 'utf-8').split('\n').map(line => line.trim()).filter(line => line !== '');
}

// Function to check wallet balance (native currency) on the Sahara blockchain
async function checkWalletBalance(privateKey) {
    const wallet = new ethers.Wallet(privateKey, provider());

    console.log(kleur.bold().blue(`🔍 Checking Balance for Wallet: ${kleur.bold().yellow(wallet.address)}...`));

    try {
        // Fetch wallet balance
        const balance = await provider().getBalance(wallet.address);
        const formattedBalance = ethers.formatUnits(balance, 18);  

        const successMessage = `✅ [${timelog()}] Wallet: ${kleur.green(wallet.address)} - Balance: ${kleur.yellow(formattedBalance)} ETH`;
        console.log(kleur.green(successMessage));
        appendLog(successMessage);
    } catch (error) {
        const errorMessage = `❌ [${timelog()}] Error checking balance for wallet ${kleur.red(wallet.address)}: ${kleur.red(error.message)}`;
        console.log(kleur.red(errorMessage));
        appendLog(errorMessage);
    }
}

// Time logging function
function timelog() {
    return moment().tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss');
}

// Log helper
function appendLog(message) {
    fs.appendFileSync('log-sahara.txt', message + '\n');
}

// Function to add delay (in ms)
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Main function to check balances for all wallets
async function main() {
    try {
        console.log(chalk.cyan("🚀 Sahara Testnet Wallet Balance Checker Started!"));
        
        // Read private keys
        const privateKeys = readPrivateKeys();
        console.log(chalk.yellow(`📜 Detected ${privateKeys.length} wallets in privatekeys.txt.`));

        // Check balance for each wallet
        for (const privateKey of privateKeys) {
            await checkWalletBalance(privateKey);
            await delay(2000); // Add delay between checks
        }

        console.log(chalk.green("\n✅ All balances checked. 🎉"));
        
    } catch (error) {
        console.error(chalk.red("❌ Error checking balances:"), error);
    }
}

export default main;
