const { Web3 } = require('web3');
const axios = require('axios');
const CONFIG = require('./config');

class TrumpCoinMonitor {
  constructor() {
    this.web3 = new Web3(CONFIG.ETHEREUM_RPC_URL);
    this.lastProcessedBlock = 0;
    this.isRunning = false;
  }

  async initialize() {
    try {
      const latestBlock = await this.web3.eth.getBlockNumber();
      this.lastProcessedBlock = Number(latestBlock);
      console.log(`🚀 Monitor initialized. Latest block: ${this.lastProcessedBlock}`);
      console.log(`📋 Monitoring ${Object.keys(CONFIG.CONTRACTS).length} TRUMP contracts:`);
      
      Object.entries(CONFIG.CONTRACTS).forEach(([key, contract]) => {
        console.log(`   • ${contract.name}: ${contract.address}`);
      });
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize monitor:', error.message);
      return false;
    }
  }

  async start() {
    if (this.isRunning) {
      console.log('⚠️  Monitor is already running');
      return;
    }

    const initialized = await this.initialize();
    if (!initialized) {
      console.error('❌ Cannot start monitor - initialization failed');
      return;
    }

    this.isRunning = true;
    console.log(`🔄 Starting Trump coin transfer monitoring...`);
    console.log(`⏱️  Poll interval: ${CONFIG.POLL_INTERVAL_MS}ms`);
    
    this.monitorLoop();
  }

  async stop() {
    this.isRunning = false;
    console.log('🛑 Stopping Trump coin monitor...');
  }

  async monitorLoop() {
    while (this.isRunning) {
      try {
        await this.checkForNewTransfers();
        await this.sleep(CONFIG.POLL_INTERVAL_MS);
      } catch (error) {
        console.error('❌ Error in monitor loop:', error.message);
        await this.sleep(CONFIG.POLL_INTERVAL_MS);
      }
    }
  }

  async checkForNewTransfers() {
    try {
      const currentBlock = Number(await this.web3.eth.getBlockNumber());
      
      if (currentBlock <= this.lastProcessedBlock) {
        return;
      }

      const fromBlock = Math.max(
        this.lastProcessedBlock + 1,
        currentBlock - CONFIG.MAX_BLOCKS_TO_SCAN
      );
      const toBlock = currentBlock;

      console.log(`🔍 Scanning blocks ${fromBlock} to ${toBlock}...`);

      for (const [contractKey, contractInfo] of Object.entries(CONFIG.CONTRACTS)) {
        await this.scanContractTransfers(contractInfo, fromBlock, toBlock);
      }

      this.lastProcessedBlock = currentBlock;
    } catch (error) {
      console.error('❌ Error checking for transfers:', error.message);
    }
  }

  async scanContractTransfers(contractInfo, fromBlock, toBlock) {
    try {
      // ERC-20 Transfer event signature
      const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
      
      const logs = await this.web3.eth.getPastLogs({
        address: contractInfo.address,
        topics: [transferTopic],
        fromBlock: fromBlock,
        toBlock: toBlock
      });

      if (logs.length > 0) {
        console.log(`\n🪙 Found ${logs.length} ${contractInfo.name} transfer(s):`);
        
        for (const log of logs) {
          await this.processTransferLog(log, contractInfo);
        }
      }
    } catch (error) {
      console.error(`❌ Error scanning ${contractInfo.name}:`, error.message);
    }
  }

  async processTransferLog(log, contractInfo) {
    try {
      // Decode transfer data
      const from = '0x' + log.topics[1].slice(26);
      const to = '0x' + log.topics[2].slice(26);
      const value = this.web3.utils.hexToNumberString(log.data);
      const amount = this.web3.utils.fromWei(value, 'ether');
      
      // Get block timestamp
      const block = await this.web3.eth.getBlock(log.blockNumber);
      const timestamp = new Date(Number(block.timestamp) * 1000).toISOString();

      const transfer = {
        contractName: contractInfo.name,
        contractAddress: contractInfo.address,
        from,
        to,
        amount,
        value,
        blockNumber: Number(log.blockNumber),
        txHash: log.transactionHash,
        timestamp
      };

      this.logTransfer(transfer);
      
      // Send webhook notification if configured
      if (CONFIG.WEBHOOK_URL) {
        await this.sendWebhookNotification(transfer);
      }
    } catch (error) {
      console.error('❌ Error processing transfer log:', error.message);
    }
  }

  logTransfer(transfer) {
    console.log(`
📤 Transfer detected:
   Token: ${transfer.contractName}
   From: ${transfer.from}
   To: ${transfer.to}
   Amount: ${transfer.amount} tokens
   Block: ${transfer.blockNumber}
   Tx: ${transfer.txHash}
   Time: ${transfer.timestamp}
   ---`);
  }

  async sendWebhookNotification(transfer) {
    try {
      await axios.post(CONFIG.WEBHOOK_URL, {
        type: 'trump_coin_transfer',
        data: transfer
      });
    } catch (error) {
      console.error('❌ Failed to send webhook:', error.message);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Handle graceful shutdown
function setupGracefulShutdown(monitor) {
  process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    await monitor.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    await monitor.stop();
    process.exit(0);
  });
}

// Main execution
if (require.main === module) {
  const monitor = new TrumpCoinMonitor();
  setupGracefulShutdown(monitor);
  monitor.start();
}

module.exports = TrumpCoinMonitor;