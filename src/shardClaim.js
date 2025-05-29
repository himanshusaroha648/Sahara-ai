import dotenv from 'dotenv';
import { JsonRpcProvider, ethers } from 'ethers';
import fs from 'fs';
import moment from 'moment-timezone';
import chalk from 'chalk';
import readline from 'readline';

dotenv.config();

// RPC Providers with fallback
const rpcProviders = [
    'https://testnet.saharalabs.ai',
    'https://rpc.testnet.sahara.network',
    'https://sahara-testnet.rpc.thirdweb.com'
];

let currentProviderIndex = 0;

function getProvider() {
    return new JsonRpcProvider(rpcProviders[currentProviderIndex]);
}

function rotateProvider() {
    currentProviderIndex = (currentProviderIndex + 1) % rpcProviders.length;
    return getProvider();
}

// Helper functions
function appendLog(message) {
    const timestamp = moment().tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss');
    fs.appendFileSync('sahara-log.txt', `[${timestamp}] ${message}\n`);
}

function readPrivateKeys() {
    return fs.readFileSync('privatekeys.txt', 'utf-8')
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);
}

async function getOptimalGasPrice(provider) {
    try {
        const feeData = await provider.getFeeData();
        // Use higher gas prices for Sahara network
        const baseFee = feeData.gasPrice || ethers.parseUnits("50", "gwei");
        return {
            maxFeePerGas: baseFee * 2n,
            maxPriorityFeePerGas: baseFee / 2n,
            gasLimit: 21000
        };
    } catch (error) {
        // Fallback values if network data fails
        return {
            maxFeePerGas: ethers.parseUnits("50", "gwei"),
            maxPriorityFeePerGas: ethers.parseUnits("25", "gwei"),
            gasLimit: 21000
        };
    }
}

async function processWallet(wallet, provider) {
    try {
        console.log(chalk.blue(`🚀 Processing wallet: ${wallet.address}`));
        
        // Get optimal gas settings
        const gasSettings = await getOptimalGasPrice(provider);
        console.log(chalk.yellow(`Gas Settings - Max Fee: ${ethers.formatUnits(gasSettings.maxFeePerGas, "gwei")} gwei, Priority Fee: ${ethers.formatUnits(gasSettings.maxPriorityFeePerGas, "gwei")} gwei`));

        // Create transaction
        const tx = {
            to: "0x310f9f43998e8a71a75ec180ac2ffa2be204af91",
            value: ethers.parseEther("0"),
            data: "0x",
            ...gasSettings,
            type: 2
        };

        // Send transaction
        const transaction = await wallet.sendTransaction(tx);
        console.log(chalk.green(`✅ Transaction sent: ${transaction.hash}`));
        
        // Wait for confirmation
        const receipt = await transaction.wait();
        console.log(chalk.green(`✅ Transaction confirmed: ${receipt.hash}`));
        
        appendLog(`Success: ${wallet.address} - ${receipt.hash}`);
        return true;
    } catch (error) {
        const errorMessage = error.message || 'Unknown error';
        console.log(chalk.red(`❌ Error: ${errorMessage}`));
        appendLog(`Error: ${wallet.address} - ${errorMessage}`);
        
        if (errorMessage.includes('insufficient funds')) {
            try {
                const balance = await provider.getBalance(wallet.address);
                console.log(chalk.yellow(`Balance: ${ethers.formatEther(balance)} ETH`));
            } catch (e) {
                // Ignore balance check error
            }
        }
        return false;
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

async function main() {
    try {
        console.log(chalk.cyan('🌍 Sahara Network Login Script'));
        console.log(chalk.cyan('==========================='));

        // Read private keys
        const privateKeys = readPrivateKeys();
        console.log(chalk.cyan(`📊 Found ${privateKeys.length} wallets`));

        // Process wallets
        for (let i = 0; i < privateKeys.length; i++) {
            const provider = getProvider();
            const wallet = new ethers.Wallet(privateKeys[i], provider);
            
            console.log(chalk.yellow(`\n📦 Processing wallet ${i + 1} of ${privateKeys.length}`));
            await processWallet(wallet, provider);
            
            // Add delay between transactions
            if (i < privateKeys.length - 1) {
                console.log(chalk.blue('⏳ Waiting 5 seconds before next transaction...'));
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }

        console.log(chalk.green('\n🎉 All transactions completed!'));
        await waitForEnter();
    } catch (error) {
        console.error(chalk.red('❌ Fatal error:'), error);
        appendLog(`Fatal Error: ${error.message}`);
        await waitForEnter();
    }
}

export default main; 
