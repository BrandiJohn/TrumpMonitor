# Trump Coin Transfer Monitor

A real-time monitoring script for Trump coin transfers on the Ethereum blockchain.

## Features

- 🔄 Real-time monitoring of Trump token transfers
- 📊 Supports multiple Trump token contracts
- 🔔 Webhook notifications (optional)
- ⚡ Configurable polling intervals
- 🛡️ Graceful shutdown handling

## Monitored Contracts

- **TRUMP Token**: `0xa56f72b634ea2d74bd9cf6fcd44aa970871d4c25`
- **TRUMP COIN**: `0x263396432fd5a10e4c740d800c9e87986c00eec6`
- **TrumpCoin Legacy**: `0x930305027ac48834a6dabe88514d4e38355105c6`
- **TrumpMeme**: `0x7c84d7e3829e004a49204d650883697bc7f06748`

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   - Copy `.env` file and add your Ethereum RPC URL
   - Recommended: Get API key from [Infura](https://infura.io/) or [Alchemy](https://alchemy.com/)
   - Update `ETHEREUM_RPC_URL` in `.env`

3. **Run the monitor:**
   ```bash
   npm start
   # or
   npm run monitor
   ```

## Configuration

Edit `.env` file:

```bash
# Ethereum RPC endpoint
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID

# Monitoring settings
POLL_INTERVAL_MS=5000
MAX_BLOCKS_TO_SCAN=100

# Optional webhook for notifications
WEBHOOK_URL=https://your-webhook-url.com/notify

# Log level
LOG_LEVEL=info
```

## Output

The monitor will display transfer information like:

```
📤 Transfer detected:
   Token: TRUMP Token
   From: 0x1234...
   To: 0x5678...
   Amount: 1000.0 tokens
   Block: 19123456
   Tx: 0xabc123...
   Time: 2025-08-09T10:30:00.000Z
```

## Requirements

- Node.js 16+
- Ethereum RPC endpoint (Infura, Alchemy, or public endpoint)

## Security Note

This is a defensive monitoring tool for tracking public blockchain transactions. All monitored data is publicly available on the Ethereum blockchain.