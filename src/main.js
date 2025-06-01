import chalk from 'chalk';
import readline from 'readline';
import { waitForEnter } from './utils.js';
import dailyLogin from './dailyLogin.js';
import shardClaim from './shardClaim.js';
import fs from 'fs';
import { ethers } from 'ethers';

// Function to perform Auto All process
async function performAutoAll() {
    console.log(chalk.cyan('\n=== Auto All Process ==='));
    console.log('This will perform both Daily Login and Shard Claim for all wallets.');
    
    // Read all private keys
    const privateKeys = fs.readFileSync('privatekeys.txt', 'utf-8')
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);
    
    console.log(chalk.cyan(`\n📊 Found ${privateKeys.length} wallets`));
    
    // Process each wallet completely before moving to the next
    for (let i = 0; i < privateKeys.length; i++) {
        console.log(chalk.cyan(`\n=== Processing Wallet ${i + 1}/${privateKeys.length} ===`));
        const wallet = new ethers.Wallet(privateKeys[i], provider());
        
        // Step 1: Perform transaction
        console.log(chalk.yellow(`\n📝 Transaction [${i + 1}/${privateKeys.length}]`));
        const txSuccess = await dailyLogin(true, i);
        
        if (txSuccess) {
            console.log(chalk.green(`✅ Transaction completed for wallet ${i + 1}`));
            
            // Step 2: Complete task for this wallet
            console.log(chalk.yellow(`\n📝 Task Completion [${i + 1}/${privateKeys.length}]`));
            const taskSuccess = await shardClaim(true, i);
            
            if (taskSuccess) {
                console.log(chalk.green(`✅ Task completed for wallet ${i + 1}`));
            } else {
                console.log(chalk.red(`❌ Task failed for wallet ${i + 1}`));
            }
        } else {
            console.log(chalk.red(`❌ Transaction failed for wallet ${i + 1}`));
        }
        
        // Add delay between wallets
        if (i < privateKeys.length - 1) {
            console.log(chalk.yellow('\n⏳ Waiting 5 seconds before next wallet...'));
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
    
    console.log(chalk.cyan('\n=== Auto All Process Complete ==='));
    await waitForEnter();
}

// Main function
async function main() {
    try {
        while (true) {
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

            const answer = await new Promise((resolve) => {
                rl.question('\n? Select an option: ', (answer) => {
                    rl.close();
                    resolve(answer);
                });
            });
            
            switch(answer) {
                case '1':
                    await dailyLogin();
                    break;
                case '2':
                    await shardClaim();
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
        }
    } catch (error) {
        console.error(chalk.red("❌ Error in main process:"), error);
        await waitForEnter();
    }
}

// Start the application
main(); 
