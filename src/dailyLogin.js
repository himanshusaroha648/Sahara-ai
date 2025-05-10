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

const baseExplorerUrl = 'https://testnet-explorer.saharalabs.ai';
const explorer = {
  get tx() {
    return (txHash) => `${baseExplorerUrl}/tx/${txHash}`;
  },
  get address() {
    return (address) => `${baseExplorerUrl}/address/${address}`;
  },
};

function appendLog(filename, message) {
  fs.appendFileSync(filename, message + '\n');
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function readPrivateKeys() {
  return fs.readFileSync('privatekeys.txt', 'utf-8')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
}

async function processWallet(wallet, index, total) {
  const timestamp = moment().tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss');
  try {
    console.log(chalk.blue(`🚀 [${index + 1}/${total}] Processing Wallet: ${wallet.address}`));

    const tx = {
      to: "0x310f9f43998e8a71a75ec180ac2ffa2be204af91",
      value: ethers.parseEther("0"),
      data: "0x",
      gasLimit: 100000 // Increased gas limit
    };

    const transaction = await wallet.sendTransaction(tx);
    await transaction.wait();

    const successMsg = `✅ [${timestamp}] SUCCESS | ${wallet.address} -> ${tx.to} | TX: ${explorer.tx(transaction.hash)}`;
    console.log(chalk.green(successMsg));
    appendLog('success.txt', successMsg);
    return true;

  } catch (error) {
    const errorMsg = `❌ [${timestamp}] ERROR | ${wallet.address} | ${error.message}`;
    console.log(chalk.red(errorMsg));
    appendLog('error.txt', errorMsg);
    return false;
  }
}

function waitForEnter() {
  return new Promise(resolve => {
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

async function main() {
  try {
    const privateKeys = readPrivateKeys();
    console.log(chalk.cyan(`🌍 Detected ${privateKeys.length} wallets in privatekeys.txt.`));

    const batchSize = 1;
    const totalBatches = Math.ceil(privateKeys.length / batchSize);

    for (let i = 0; i < privateKeys.length; i += batchSize) {
      const batchNumber = Math.floor(i / batchSize) + 1;
      console.log(chalk.yellow(`📦 Processing Batch ${batchNumber} of ${totalBatches}...`));

      const batch = privateKeys.slice(i, i + batchSize);
      const wallets = batch.map(pk => new ethers.Wallet(pk, provider()));

      for (let j = 0; j < wallets.length; j++) {
        await processWallet(wallets[j], i + j, privateKeys.length);
        await delay(2000); // Delay between wallets
      }

      console.log(chalk.green(`✅ Batch ${batchNumber} completed.`));
      await delay(5000); // Delay between batches
    }

    console.log(chalk.green("\n🎉 All transactions attempted."));
    await waitForEnter();

  } catch (error) {
    console.error(chalk.red("❌ Error in main process:"), error);
    await waitForEnter();
  }
}

export default main;
