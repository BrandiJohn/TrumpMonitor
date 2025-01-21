require('dotenv').config();

const TRUMP_CONTRACTS = {
  'TRUMP_MAIN': {
    address: '0xa56f72b634ea2d74bd9cf6fcd44aa970871d4c25',
    name: 'TRUMP Token',
    decimals: 18
  },
  'TRUMP_COIN': {
    address: '0x263396432fd5a10e4c740d800c9e87986c00eec6',
    name: 'TRUMP COIN',
    decimals: 18
  },
  'TRUMPCOIN_LEGACY': {
    address: '0x930305027ac48834a6dabe88514d4e38355105c6',
    name: 'TrumpCoin Legacy',
    decimals: 8
  },
  'TRUMP_MEME': {
    address: '0x7c84d7e3829e004a49204d650883697bc7f06748',
    name: 'TrumpMeme',
    decimals: 18
  }
};

// ERC-20 Transfer event signature - reusable constant
const TRANSFER_EVENT_SIGNATURE = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// ERC-20 balanceOf function ABI - reusable constant
const BALANCE_OF_ABI = {
  "inputs": [{"name": "account", "type": "address"}],
  "name": "balanceOf", 
  "outputs": [{"name": "", "type": "uint256"}],
  "stateMutability": "view",
  "type": "function"
};

const CONFIG = {
  // Ethereum network settings
  ETHEREUM_RPC_URL: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
  BACKUP_RPC_URLS: (process.env.BACKUP_RPC_URLS || '').split(',').filter(Boolean),
  
  // Monitoring settings
  POLL_INTERVAL_MS: Math.max(1000, parseInt(process.env.POLL_INTERVAL_MS) || 5000),
  MAX_BLOCKS_TO_SCAN: Math.min(1000, Math.max(1, parseInt(process.env.MAX_BLOCKS_TO_SCAN) || 100)),
  RETRY_ATTEMPTS: parseInt(process.env.RETRY_ATTEMPTS) || 3,
  RETRY_DELAY_MS: parseInt(process.env.RETRY_DELAY_MS) || 1000,
  
  // Performance settings
  BATCH_SIZE: parseInt(process.env.BATCH_SIZE) || 10,
  CONNECTION_TIMEOUT_MS: parseInt(process.env.CONNECTION_TIMEOUT_MS) || 30000,
  
  // Notification settings
  WEBHOOK_URL: process.env.WEBHOOK_URL,
  WEBHOOK_TIMEOUT_MS: parseInt(process.env.WEBHOOK_TIMEOUT_MS) || 5000,
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  ENABLE_DETAILED_LOGS: process.env.ENABLE_DETAILED_LOGS === 'true',
  
  // Contract addresses and constants
  CONTRACTS: TRUMP_CONTRACTS,
  TRANSFER_EVENT_SIGNATURE,
  BALANCE_OF_ABI
};

module.exports = CONFIG;