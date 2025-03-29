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
    try:
        if web3.is_connected():
            print("✅ Connected to Sahara Testnet")
            print(f"⛓ Chain ID: {CHAIN_ID}")
            print(f"📦 Latest block: {web3.eth.block_number}\n")
            return True
        print("❌ Connection failed")
        return False
    except Exception as e:
        print(f"❌ Connection error: {str(e)}")
        return False

def get_contract_code(address):
    """Check if contract exists at address"""
    return web3.eth.get_code(address)

def get_balances(wallet_address):
    """Get both native and token balances"""
    try:
        # Check native balance
        native_balance = web3.eth.get_balance(wallet_address)
        
        # Check if contract exists
        contract_code = get_contract_code(SHARAR_LEGEND_CONTRACT)
        if contract_code == b'':
            return {
                'native': web3.from_wei(native_balance, 'ether'),
                'tokens': None,
                'error': 'Contract not deployed at this address'
            }
        
        # Try to get token balance
        token_contract = web3.eth.contract(address=SHARAR_LEGEND_CONTRACT, abi=TOKEN_ABI)
        token_balance = token_contract.functions.balanceOf(wallet_address).call()
        
        return {
            'native': web3.from_wei(native_balance, 'ether'),
            'tokens': token_balance / (10**18)  # Assuming 18 decimals
        }
    except Exception as e:
        return {
            'native': web3.from_wei(native_balance, 'ether'),
            'tokens': None,
            'error': str(e)
        }

def main():
    print("\n" + "="*50)
    print("🪙 Sharar Legend Token Manager")
    print("="*50 + "\n")
    
    if not check_connection():
        exit()

    wallet_address = input("Enter wallet address: ").strip()
    
    # Validate address
    if not web3.is_address(wallet_address):
        print("❌ Invalid wallet address")
        return
    
    balances = get_balances(wallet_address)
    
    print(f"\n💎 Native Balance: {balances['native']} SAHARA")
    
    if balances.get('error'):
        print(f"\n❌ Error checking token balance: {balances['error']}")
        print("\nPossible solutions:")
        print("1. Verify the contract address is correct")
        print("2. Check if the token is deployed on this network")
        print("3. The ABI might not match the actual contract")
    elif balances['tokens'] is not None:
        print(f"🪙 Token Balance: {balances['tokens']} Sharar Legend")
    else:
        print("🪙 Token Balance: Not available")

if __name__ == "__main__":
    main()