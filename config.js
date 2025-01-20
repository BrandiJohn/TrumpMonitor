require('dotenv').config();

const TRUMP_CONTRACTS = {
  // Primary TRUMP tokens with their contract addresses
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

const CONFIG = {
  // Ethereum network settings
  ETHEREUM_RPC_URL: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
  
  // Monitoring settings
  POLL_INTERVAL_MS: parseInt(process.env.POLL_INTERVAL_MS) || 5000,
  MAX_BLOCKS_TO_SCAN: parseInt(process.env.MAX_BLOCKS_TO_SCAN) || 100,
  
  // Notification settings
  WEBHOOK_URL: process.env.WEBHOOK_URL,
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  
  // Contract addresses to monitor
  CONTRACTS: TRUMP_CONTRACTS
};

module.exports = CONFIG;