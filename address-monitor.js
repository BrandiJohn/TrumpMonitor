const { Web3 } = require('web3');
const axios = require('axios');
const CONFIG = require('./config');

class AddressMonitor {
  constructor(targetAddress) {
    this.targetAddress = targetAddress.toLowerCase();
    this.lastProcessedBlock = 0;
    this.isRunning = false;
    this.retryCount = 0;
    this.currentRpcIndex = 0;
    this.web3 = this.createWeb3Instance();
    this.contractCache = new Map();
    this.blockCache = new Map();
  }

  createWeb3Instance() {
    const rpcUrls = [CONFIG.ETHEREUM_RPC_URL, ...CONFIG.BACKUP_RPC_URLS].filter(Boolean);
    const currentUrl = rpcUrls[this.currentRpcIndex % rpcUrls.length];
    
    return new Web3(currentUrl, {
      timeout: CONFIG.CONNECTION_TIMEOUT_MS,
      reconnect: {
        auto: true,
        delay: CONFIG.RETRY_DELAY_MS,
        maxAttempts: CONFIG.RETRY_ATTEMPTS,
        onTimeout: true
      }
    });
  }

  async switchToBackupRpc() {
    const rpcUrls = [CONFIG.ETHEREUM_RPC_URL, ...CONFIG.BACKUP_RPC_URLS].filter(Boolean);
    if (rpcUrls.length > 1) {
      this.currentRpcIndex = (this.currentRpcIndex + 1) % rpcUrls.length;
      this.web3 = this.createWeb3Instance();
      console.log(`🔄 切换到备用RPC: ${rpcUrls[this.currentRpcIndex]}`);
    }
  }

  async executeWithRetry(operation, operationName) {
    let lastError;
    
    for (let attempt = 1; attempt <= CONFIG.RETRY_ATTEMPTS; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        console.warn(`⚠️ ${operationName} 失败 (尝试 ${attempt}/${CONFIG.RETRY_ATTEMPTS}): ${error.message}`);
        
        if (attempt < CONFIG.RETRY_ATTEMPTS) {
          if (attempt === 2) {
            await this.switchToBackupRpc();
          }
          await this.sleep(CONFIG.RETRY_DELAY_MS * attempt);
        }
      }
    }
    
    throw lastError;
  }

  async initialize() {
    try {
      const latestBlock = await this.executeWithRetry(
        () => this.web3.eth.getBlockNumber(),
        '获取最新区块'
      );
      
      this.lastProcessedBlock = Number(latestBlock);
      
      console.log(`🎯 监控地址: ${this.targetAddress}`);
      console.log(`🚀 初始化完成。当前区块: ${this.lastProcessedBlock}`);
      console.log(`📋 监控 ${Object.keys(CONFIG.CONTRACTS).length} 个Trump代币合约:`);
      
      Object.entries(CONFIG.CONTRACTS).forEach(([key, contract]) => {
        console.log(`   • ${contract.name}: ${contract.address}`);
        // 预缓存合约实例
        this.contractCache.set(contract.address, 
          new this.web3.eth.Contract([CONFIG.BALANCE_OF_ABI], contract.address)
        );
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
      const currentBlock = Number(await this.executeWithRetry(
        () => this.web3.eth.getBlockNumber(),
        '获取当前区块'
      ));
      
      if (currentBlock <= this.lastProcessedBlock) {
        return;
      }

      const fromBlock = Math.max(
        this.lastProcessedBlock + 1,
        currentBlock - CONFIG.MAX_BLOCKS_TO_SCAN
      );
      const toBlock = currentBlock;

      if (CONFIG.ENABLE_DETAILED_LOGS) {
        console.log(`🔍 扫描区块 ${fromBlock} 到 ${toBlock}...`);
      }

      // 并行处理多个合约以提高性能
      const contractEntries = Object.entries(CONFIG.CONTRACTS);
      const batchSize = CONFIG.BATCH_SIZE;
      
      for (let i = 0; i < contractEntries.length; i += batchSize) {
        const batch = contractEntries.slice(i, i + batchSize);
        const promises = batch.map(([contractKey, contractInfo]) => 
          this.scanAddressTransfers(contractInfo, fromBlock, toBlock)
            .catch(error => {
              console.error(`❌ 扫描合约 ${contractInfo.name} 失败:`, error.message);
              return [];
            })
        );
        
        await Promise.allSettled(promises);
      }

      this.lastProcessedBlock = currentBlock;
      this.retryCount = 0; // 重置重试计数
    } catch (error) {
      console.error('❌ 检查转账错误:', error.message);
      this.retryCount++;
      
      if (this.retryCount >= CONFIG.RETRY_ATTEMPTS) {
        console.error('❌ 达到最大重试次数，切换到备用RPC...');
        await this.switchToBackupRpc();
        this.retryCount = 0;
      }
    }
  }

  async scanAddressTransfers(contractInfo, fromBlock, toBlock) {
    return await this.executeWithRetry(async () => {
      const paddedAddress = '0x' + this.targetAddress.slice(2).padStart(64, '0');
      
      // 并行获取入账和出账日志
      const [incomingLogs, outgoingLogs] = await Promise.all([
        this.web3.eth.getPastLogs({
          address: contractInfo.address,
          topics: [CONFIG.TRANSFER_EVENT_SIGNATURE, null, paddedAddress],
          fromBlock: fromBlock,
          toBlock: toBlock
        }),
        this.web3.eth.getPastLogs({
          address: contractInfo.address, 
          topics: [CONFIG.TRANSFER_EVENT_SIGNATURE, paddedAddress, null],
          fromBlock: fromBlock,
          toBlock: toBlock
        })
      ]);

      const allLogs = [...incomingLogs, ...outgoingLogs]
        .sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber)); // 按区块排序
      
      if (allLogs.length > 0) {
        console.log(`\n🪙 发现 ${allLogs.length} 笔 ${contractInfo.name} 相关转账:`);
        
        // 批量处理日志以提高性能
        const batchSize = CONFIG.BATCH_SIZE;
        for (let i = 0; i < allLogs.length; i += batchSize) {
          const batch = allLogs.slice(i, i + batchSize);
          await Promise.all(batch.map(log => 
            this.processAddressTransferLog(log, contractInfo)
              .catch(error => {
                console.error(`❌ 处理转账日志失败:`, error.message);
              })
          ));
        }
      }
      
      return allLogs;
    }, `扫描${contractInfo.name}转账`);
  }

  async processAddressTransferLog(log, contractInfo) {
    try {
      // Decode transfer data
      const from = '0x' + log.topics[1].slice(26);
      const to = '0x' + log.topics[2].slice(26);
      const value = this.web3.utils.hexToNumberString(log.data);
      
      // 使用合约的实际小数位数进行转换
      const decimals = contractInfo.decimals || 18;
      const divisor = BigInt(10 ** decimals);
      const amount = (BigInt(value) * BigInt(1000000)) / divisor / BigInt(1000000); // 保留6位精度
      
      // Determine direction
      const isIncoming = to.toLowerCase() === this.targetAddress;
      
      // 缓存区块信息以减少重复请求
      let block = this.blockCache.get(log.blockNumber);
      if (!block) {
        block = await this.executeWithRetry(
          () => this.web3.eth.getBlock(log.blockNumber),
          `获取区块${log.blockNumber}`
        );
        this.blockCache.set(log.blockNumber, block);
        
        // 限制缓存大小
        if (this.blockCache.size > 100) {
          const firstKey = this.blockCache.keys().next().value;
          this.blockCache.delete(firstKey);
        }
      }
      
      const timestamp = new Date(Number(block.timestamp) * 1000).toISOString();

      const transfer = {
        contractName: contractInfo.name,
        contractAddress: contractInfo.address,
        from,
        to,
        amount: amount.toString(),
        value,
        direction: isIncoming ? '接收' : '发送',
        blockNumber: Number(log.blockNumber),
        txHash: log.transactionHash,
        timestamp,
        targetAddress: this.targetAddress,
        decimals
      };

      this.logAddressTransfer(transfer);
      
      // Send webhook notification if configured (with timeout)
      if (CONFIG.WEBHOOK_URL) {
        this.sendWebhookNotification(transfer).catch(error => {
          console.error('❌ Webhook发送失败:', error.message);
        });
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
      const response = await axios.post(CONFIG.WEBHOOK_URL, {
        type: 'trump_coin_address_transfer',
        data: transfer,
        timestamp: new Date().toISOString()
      }, {
        timeout: CONFIG.WEBHOOK_TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'TrumpMonitor/1.0'
        }
      });
      
      if (CONFIG.ENABLE_DETAILED_LOGS) {
        console.log(`✅ Webhook发送成功: ${response.status}`);
      }
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        console.error('❌ Webhook超时:', error.message);
      } else {
        console.error('❌ 发送webhook失败:', error.message);
      }
      throw error;
    }
  }

  async getAddressBalance() {
    console.log(`\n💰 查询地址 ${this.targetAddress} 的Trump币余额:`);
    
    const contractEntries = Object.entries(CONFIG.CONTRACTS);
    const balancePromises = contractEntries.map(async ([contractKey, contractInfo]) => {
      try {
        let contract = this.contractCache.get(contractInfo.address);
        if (!contract) {
          contract = new this.web3.eth.Contract([CONFIG.BALANCE_OF_ABI], contractInfo.address);
          this.contractCache.set(contractInfo.address, contract);
        }
        
        const balance = await this.executeWithRetry(
          () => contract.methods.balanceOf(this.targetAddress).call(),
          `查询${contractInfo.name}余额`
        );
        
        const decimals = contractInfo.decimals || 18;
        const divisor = BigInt(10 ** decimals);
        const formattedBalance = (BigInt(balance) * BigInt(1000000)) / divisor / BigInt(1000000);
        
        return { name: contractInfo.name, balance: formattedBalance.toString(), success: true };
      } catch (error) {
        return { name: contractInfo.name, error: error.message, success: false };
      }
    });
    
    const results = await Promise.allSettled(balancePromises);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const { name, balance, error, success } = result.value;
        if (success) {
          console.log(`   ${name}: ${balance} tokens`);
        } else {
          console.log(`   ${name}: 查询失败 (${error})`);
        }
      } else {
        console.log(`   ${contractEntries[index][1].name}: 查询失败 (${result.reason.message})`);
      }
    });
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