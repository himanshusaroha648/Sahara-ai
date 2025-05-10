import inquirer from 'inquirer';
import chalk from 'chalk';
import printBanner from './banner.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
        console.log(chalk.yellow("4. Exit"));
        console.log(""); // Add a blank line for spacing

        // Get user choice
        const { choice } = await inquirer.prompt([
            {
                type: 'input',
                name: 'choice',
                message: 'Select an option:',
                validate: (input) => {
                    const num = parseInt(input);
                    if (isNaN(num) || num < 1 || num > 4) {
                        return 'Please enter a valid option (1-4)';
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
            '4': 'Exit'
        };

        const selectedOption = menuOptions[choice];

        // Handle the selected option
        switch (selectedOption) {
            case 'Daily Login':
                const dailyLogin = await import('./src/dailyLogin.js');
                await dailyLogin.default();
                break;
            case 'Shard Claim':
                const shardClaim = await import('./src/shardClaim.js');
                await shardClaim.default();
                break;
            case 'Balance':
                const balance = await import('./src/Balance.js');
                await balance.default();
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
