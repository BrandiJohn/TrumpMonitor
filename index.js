const TrumpCoinMonitor = require('./monitor');

console.log('🇺🇸 Trump Coin Transfer Monitor');
console.log('================================');
console.log('');

const monitor = new TrumpCoinMonitor();
monitor.start();