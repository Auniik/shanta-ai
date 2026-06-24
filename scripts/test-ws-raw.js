#!/usr/bin/env node
const { WebSocket } = require('ws');
const crypto = require('crypto');

const USERNAME = process.argv[2] || 'D00211';
const PASSWORD = process.argv[3] || 'nedquW-6we-hut1d';

const APP_VERSION = 'DFNUAMOB_XX_SHANTA_1.010.06.0+9dbc1750';
const CHANNEL_ID = 32;
const OMS_URL = 'wss://easytrade.shantasecurities.com/streaming-api';

const hash = crypto.createHash('sha256').update(PASSWORD).digest('hex');
console.log(`SHA-256 hash: ${hash}`);

const authMsg = JSON.stringify({
  HED: {
    msgTyp: 1,
    channel: CHANNEL_ID,
    commVer: APP_VERSION,
    loginId: '',
    instId: '',
    sesnId: '',
    routeId: '',
    clientIp: '192.168.0.1',
    tenantCode: 'DEFAULT_TENANT',
    unqReqId: `0_${Date.now()}`,
  },
  DAT: {
    lgnNme: USERNAME,
    isSkipTwoFCTA: '0',
    pwd: hash,
  },
});

console.log('\nConnecting to:', OMS_URL);
console.log('Sending auth (channel=32, full commVer)...');

const ws = new WebSocket(OMS_URL, {
  headers: {
    'Origin': 'https://easytrade.shantasecurities.com',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  },
});

const t = setTimeout(() => { console.log('\n[TIMEOUT 15s]'); ws.close(); }, 15000);

ws.on('open', () => {
  console.log('[OPEN] Connection established');
  console.log('[SEND]', authMsg);
  ws.send(authMsg);
});

ws.on('message', (data) => {
  console.log('[RECV]', data.toString());
});

ws.on('error', (err) => {
  console.log('[ERROR]', err.message);
  clearTimeout(t);
});

ws.on('close', (code, reason) => {
  console.log(`[CLOSE] code=${code} reason="${reason.toString()}"`);
  clearTimeout(t);
});
