const { Web3 } = require('web3');
const axios = require('axios');
const CONFIG = require('./config');

class AddressMonitor {
  constructor(targetAddress) {
    this.web3 = new Web3(CONFIG.ETHEREUM_RPC_URL);
    this.targetAddress = targetAddress.toLowerCase();
    this.lastProcessedBlock = 0;
    this.isRunning = false;
  }

  async initialize() {
    try {
      const latestBlock = await this.web3.eth.getBlockNumber();
      this.lastProcessedBlock = Number(latestBlock);
      console.log(`🎯 监控地址: ${this.targetAddress}`);
      console.log(`🚀 初始化完成。当前区块: ${this.lastProcessedBlock}`);
      console.log(`📋 监控 ${Object.keys(CONFIG.CONTRACTS).length} 个Trump代币合约:`);
      
      Object.entries(CONFIG.CONTRACTS).forEach(([key, contract]) => {
        console.log(`   • ${contract.name}: ${contract.address}`);
      });
      
      return true;
    } catch (error) {
      console.error('❌ 初始化失败:', error.message);
      return false;
    }
  }

  async start() {
    if (this.isRunning) {
      console.log('⚠️  监控已在运行中');
      return;
    }

    const initialized = await this.initialize();
    if (!initialized) {
      console.error('❌ 无法启动监控 - 初始化失败');
      return;
    }

    this.isRunning = true;
    console.log(`🔄 开始监控地址 ${this.targetAddress} 的Trump币转移...`);
    console.log(`⏱️  轮询间隔: ${CONFIG.POLL_INTERVAL_MS}ms`);
    
    this.monitorLoop();
  }

  async stop() {
    this.isRunning = false;
    console.log('🛑 停止地址监控...');
  }

  async monitorLoop() {
    while (this.isRunning) {
      try {
        await this.checkForAddressTransfers();
        await this.sleep(CONFIG.POLL_INTERVAL_MS);
      } catch (error) {
        console.error('❌ 监控循环错误:', error.message);
        await this.sleep(CONFIG.POLL_INTERVAL_MS);
      }
    }
  }

  async checkForAddressTransfers() {
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

      console.log(`🔍 扫描区块 ${fromBlock} 到 ${toBlock}...`);

      for (const [contractKey, contractInfo] of Object.entries(CONFIG.CONTRACTS)) {
        await this.scanAddressTransfers(contractInfo, fromBlock, toBlock);
      }

      this.lastProcessedBlock = currentBlock;
    } catch (error) {
      console.error('❌ 检查转账错误:', error.message);
    }
  }

  async scanAddressTransfers(contractInfo, fromBlock, toBlock) {
    try {
      // ERC-20 Transfer event signature
      const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
      const paddedAddress = '0x' + this.targetAddress.slice(2).padStart(64, '0');
      
      // Monitor both incoming and outgoing transfers
      const incomingLogs = await this.web3.eth.getPastLogs({
        address: contractInfo.address,
        topics: [transferTopic, null, paddedAddress], // to address
        fromBlock: fromBlock,
        toBlock: toBlock
      });

      const outgoingLogs = await this.web3.eth.getPastLogs({
        address: contractInfo.address,
        topics: [transferTopic, paddedAddress, null], // from address
        fromBlock: fromBlock,
        toBlock: toBlock
      });

      const allLogs = [...incomingLogs, ...outgoingLogs];
      
      if (allLogs.length > 0) {
        console.log(`\n🪙 发现 ${allLogs.length} 笔 ${contractInfo.name} 相关转账:`);
        
        for (const log of allLogs) {
          await this.processAddressTransferLog(log, contractInfo);
        }
      }
    } catch (error) {
      console.error(`❌ 扫描 ${contractInfo.name} 错误:`, error.message);
    }
  }

  async processAddressTransferLog(log, contractInfo) {
    try {
      // Decode transfer data
      const from = '0x' + log.topics[1].slice(26);
      const to = '0x' + log.topics[2].slice(26);
      const value = this.web3.utils.hexToNumberString(log.data);
      const amount = this.web3.utils.fromWei(value, 'ether');
      
      // Determine direction
      const isIncoming = to.toLowerCase() === this.targetAddress;
      const isOutgoing = from.toLowerCase() === this.targetAddress;
      
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
        direction: isIncoming ? '接收' : '发送',
        blockNumber: Number(log.blockNumber),
        txHash: log.transactionHash,
        timestamp,
        targetAddress: this.targetAddress
      };

      this.logAddressTransfer(transfer);
      
      // Send webhook notification if configured
      if (CONFIG.WEBHOOK_URL) {
        await this.sendWebhookNotification(transfer);
      }
    } catch (error) {
      console.error('❌ 处理转账日志错误:', error.message);
    }
  }

  logAddressTransfer(transfer) {
    const direction = transfer.direction === '接收' ? '📥' : '📤';
    const otherParty = transfer.direction === '接收' ? transfer.from : transfer.to;
    
    console.log(`
${direction} ${transfer.direction} Trump币:
   代币: ${transfer.contractName}
   ${transfer.direction === '接收' ? '发送方' : '接收方'}: ${otherParty}
   数量: ${transfer.amount} tokens
   区块: ${transfer.blockNumber}
   交易哈希: ${transfer.txHash}
   时间: ${transfer.timestamp}
   ---`);
  }

  async sendWebhookNotification(transfer) {
    try {
      await axios.post(CONFIG.WEBHOOK_URL, {
        type: 'trump_coin_address_transfer',
        data: transfer
      });
    } catch (error) {
      console.error('❌ 发送webhook失败:', error.message);
    }
  }

  async getAddressBalance() {
    console.log(`\n💰 查询地址 ${this.targetAddress} 的Trump币余额:`);
    
    for (const [contractKey, contractInfo] of Object.entries(CONFIG.CONTRACTS)) {
      try {
        // ERC-20 balanceOf function call
        const balanceOfABI = {
          "inputs": [{"name": "account", "type": "address"}],
          "name": "balanceOf",
          "outputs": [{"name": "", "type": "uint256"}],
          "stateMutability": "view",
          "type": "function"
        };
        
        const contract = new this.web3.eth.Contract([balanceOfABI], contractInfo.address);
        const balance = await contract.methods.balanceOf(this.targetAddress).call();
        const formattedBalance = this.web3.utils.fromWei(balance, 'ether');
        
        console.log(`   ${contractInfo.name}: ${formattedBalance} tokens`);
      } catch (error) {
        console.log(`   ${contractInfo.name}: 查询失败 (${error.message})`);
      }
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Handle graceful shutdown
function setupGracefulShutdown(monitor) {
  process.on('SIGINT', async () => {
    console.log('\n🛑 收到SIGINT信号，优雅关闭...');
    await monitor.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 收到SIGTERM信号，优雅关闭...');
    await monitor.stop();
    process.exit(0);
  });
}

// Main execution
if (require.main === module) {
  const targetAddress = process.argv[2];
  
  if (!targetAddress) {
    console.log('用法: node address-monitor.js <地址>');
    console.log('示例: node address-monitor.js 0x1234567890123456789012345678901234567890');
    process.exit(1);
  }

  if (!targetAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
    console.error('❌ 无效的以太坊地址格式');
    process.exit(1);
  }

  const monitor = new AddressMonitor(targetAddress);
  setupGracefulShutdown(monitor);
  
  // Show current balance before starting monitoring
  monitor.getAddressBalance().then(() => {
    console.log('\n' + '='.repeat(50));
    monitor.start();
  });
}

module.exports = AddressMonitor;