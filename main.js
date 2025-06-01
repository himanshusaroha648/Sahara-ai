import inquirer from 'inquirer';
import chalk from 'chalk';
import printBanner from './banner.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { ethers } from 'ethers';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// RPC Provider
const provider = new ethers.JsonRpcProvider('https://testnet.saharalabs.ai');

// Show banner
printBanner();

// Main menu function
async function mainMenu() {
    try {
        // Display menu options
        console.log(chalk.cyan("\n=== MENU OPTIONS ==="));
        console.log(chalk.yellow("1. Daily Login"));
        console.log(chalk.yellow("2. Shard Claim"));
        console.log(chalk.yellow("3. Balance"));
        console.log(chalk.yellow("4. Auto All"));
        console.log(chalk.yellow("5. Exit"));
        console.log(""); // Add a blank line for spacing

        // Get user choice
        const { choice } = await inquirer.prompt([
            {
                type: 'input',
                name: 'choice',
                message: 'Select an option:',
                validate: (input) => {
                    const num = parseInt(input);
                    if (isNaN(num) || num < 1 || num > 5) {
                        return 'Please enter a valid option (1-5)';
                    }
                    return true;
                }
            }
        ]);

        // Convert numeric input to menu option
        const menuOptions = {
            '1': 'Daily Login',
            '2': 'Shard Claim',
            '3': 'Balance',
            '4': 'Auto All',
            '5': 'Exit'
        };

        const selectedOption = menuOptions[choice];

        // Handle the selected option
        switch (selectedOption) {
            case 'Daily Login':
                try {
                    console.log(chalk.cyan('🚀 Starting Daily Login Transaction...'));
                    const dailyLoginModule = await import('./src/dailyLogin.js');
                    await dailyLoginModule.default(true, null, true); // Pass true to skip tasks
                } catch (error) {
                    console.error(chalk.red('❌ Error in Daily Login:'), error);
                }
                break;
            case 'Shard Claim':
                try {
                    console.log(chalk.cyan('🚀 Starting Task Completion...'));
                    const shardClaimModule = await import('./src/shardClaim.js');
                    await shardClaimModule.default();
                } catch (error) {
                    console.error(chalk.red('❌ Error in Shard Claim:'), error);
                }
                break;
            case 'Balance':
                try {
                    const privateKeys = fs.readFileSync('privatekeys.txt', 'utf-8')
                        .split('\n')
                        .map(line => line.trim())
                        .filter(line => line && !line.startsWith('#') && line.length === 64);
                    
                    console.log(chalk.cyan('\n=== Wallet Balances ==='));
                    for (const privateKey of privateKeys) {
                        const wallet = new ethers.Wallet(privateKey, provider);
                        const balance = await provider.getBalance(wallet.address);
                        console.log(chalk.yellow(`${wallet.address}: ${ethers.formatEther(balance)} ETH`));
                    }
                    console.log(chalk.cyan('=====================\n'));
                } catch (error) {
                    console.error(chalk.red('❌ Error checking balance:'), error);
                }
                break;
            case 'Auto All':
                console.log(chalk.cyan('🚀 Starting Auto All Process...'));
                try {
                    // Read private keys
                    const privateKeys = fs.readFileSync('privatekeys.txt', 'utf-8')
                        .split('\n')
                        .map(line => line.trim())
                        .filter(line => line && !line.startsWith('#') && line.length === 64);
                    
                    console.log(chalk.cyan(`\n📝 Found ${privateKeys.length} wallets to process`));
                    
                    // Step 1: Process all transactions first
                    console.log(chalk.cyan('\n📝 Step 1: Processing all transactions...'));
                    const dailyLoginModule = await import('./src/dailyLogin.js');
                    for (let i = 0; i < privateKeys.length; i++) {
                        console.log(chalk.yellow(`\nProcessing wallet ${i + 1} of ${privateKeys.length}`));
                        const wallet = new ethers.Wallet(privateKeys[i], provider);
                        await dailyLoginModule.default(true, wallet, true); // Skip task completion
                        if (i < privateKeys.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 5000));
                        }
                    }
                    
                    // Step 2: Process all task claims
                    console.log(chalk.cyan('\n📝 Step 2: Processing all task claims...'));
                    const shardClaimModule = await import('./src/shardClaim.js');
                    await shardClaimModule.default();
                    
                    console.log(chalk.green('\n✅ Auto All process completed!'));
                } catch (error) {
                    console.error(chalk.red('❌ Error in Auto All process:'), error);
                }
                break;
            case 'Exit':
                console.log(chalk.green('Goodbye!'));
                process.exit(0);
                break;
        }

        // Wait for user to press Enter before showing menu again
        await inquirer.prompt([
            {
                type: 'input',
                name: 'continue',
                message: '\nPress Enter to return to main menu...',
            }
        ]);

        // Show menu again
        mainMenu();
    } catch (error) {
        console.error(chalk.red('Error:'), error);
        // Wait for user to press Enter before showing menu again
        await inquirer.prompt([
            {
                type: 'input',
                name: 'continue',
                message: '\nPress Enter to return to main menu...',
            }
        ]);
        mainMenu();
    }
}

// Start the program
mainMenu();
