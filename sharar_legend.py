from web3 import Web3
import json

# Sahara Testnet Configuration
SAHARA_RPC_URL = "https://testnet.saharalabs.ai"
CHAIN_ID = 313313
EXPLORER_URL = "https://testnet-explorer.saharalabs.ai"

# Sharar Legend Token Contract
SHARAR_LEGEND_CONTRACT = "0x3c3364173607CB4D1D5adD83E3F4a24Be0Fa870b"
TOKEN_ABI = [
    {
        "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "address", "name": "recipient", "type": "address"},
            {"internalType": "uint256", "name": "amount", "type": "uint256"}
        ],
        "name": "transfer",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]

# Initialize Web3
web3 = Web3(Web3.HTTPProvider(SAHARA_RPC_URL))

def check_connection():
    """Check connection to Sahara Testnet"""
    if web3.is_connected():
        print("✅ Connected to Sahara Testnet")
        print(f"⛓ Chain ID: {CHAIN_ID}")
        print(f"📦 Latest block: {web3.eth.block_number}\n")
        return True
    print("❌ Connection failed")
    return False

def get_balances(wallet_address):
    """Get both native and token balances"""
    native_balance = web3.eth.get_balance(wallet_address)
    token_contract = web3.eth.contract(address=SHARAR_LEGEND_CONTRACT, abi=TOKEN_ABI)
    token_balance = token_contract.functions.balanceOf(wallet_address).call()
    return {
        'native': web3.from_wei(native_balance, 'ether'),
        'tokens': token_balance / (10**18)  # Assuming 18 decimals
    }

def transfer_tokens(private_key, recipient, amount):
    """Transfer Sharar Legend tokens"""
    account = web3.eth.account.from_key(private_key)
    contract = web3.eth.contract(address=SHARAR_LEGEND_CONTRACT, abi=TOKEN_ABI)
    
    tx = contract.functions.transfer(
        recipient,
        int(amount * (10**18))  # Convert to wei
    ).build_transaction({
        'chainId': CHAIN_ID,
        'gas': 200000,
        'gasPrice': web3.to_wei('10', 'gwei'),
        'nonce': web3.eth.get_transaction_count(account.address),
    })
    
    signed_tx = web3.eth.account.sign_transaction(tx, private_key)
    tx_hash = web3.eth.send_raw_transaction(signed_tx.rawTransaction)
    return tx_hash.hex()

def main():
    print("\n" + "="*50)
    print("🪙 Sharar Legend Token Manager")
    print("="*50 + "\n")
    
    if not check_connection():
        exit()

    # Get wallet info
    private_key = input("Enter private key (or leave blank for balance check): ").strip()
    wallet_address = input("Enter wallet address: ").strip()
    
    # Get balances
    balances = get_balances(wallet_address)
    print(f"\n💎 Native Balance: {balances['native']} SAHARA")
    print(f"🪙 Token Balance: {balances['tokens']} Sharar Legend")
    
    # Transfer tokens if private key provided
    if private_key:
        recipient = input("\nEnter recipient address: ").strip()
        amount = float(input("Enter amount to send: "))
        
        print("\n🚀 Sending transaction...")
        tx_hash = transfer_tokens(private_key, recipient, amount)
        print(f"\n✅ Transaction successful!")
        print(f"🔗 View on explorer: {EXPLORER_URL}/tx/{tx_hash}")

if __name__ == "__main__":
    main()
