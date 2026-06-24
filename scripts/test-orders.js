#!/usr/bin/env node
/**
 * Probe order list with different ordCatgry values to see what each returns.
 */
const { WebSocket } = require('ws');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CRED_FILE = path.join(os.homedir(), '.shanta-ai', 'easytrade.json');
const { username, password } = JSON.parse(fs.readFileSync(CRED_FILE, 'utf-8'));

const APP_VERSION = 'DFNUAMOB_XX_SHANTA_1.010.06.0+9dbc1750';
const OMS_URL = 'wss://easytrade.shantasecurities.com/streaming-api';
const CHANNEL_ID = 32;

let counter = 0;
function msg(msgTyp, session, dat) {
  return JSON.stringify({
    HED: {
      msgTyp, channel: CHANNEL_ID, commVer: APP_VERSION,
      loginId: session?.loginId ?? '', instId: session?.instId ?? '',
      sesnId: session?.sessionId ?? '', routeId: session?.routeId ?? '',
      clientIp: '192.168.0.1', tenantCode: 'DEFAULT_TENANT',
      unqReqId: `${counter++}_${Date.now()}`,
    },
    DAT: dat,
  });
}

async function run() {
  const ws = new WebSocket(OMS_URL, {
    headers: {
      Origin: 'https://easytrade.shantasecurities.com',
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    },
  });

  const responses = new Map();
  let session = null;

  const send = (m) => ws.send(m);

  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('auth timeout')), 20000);
    ws.on('open', () => {
      send(msg(1, null, {
        lgnNme: username,
        isSkipTwoFCTA: '0',
        pwd: crypto.createHash('sha256').update(password).digest('hex'),
      }));
    });
    ws.on('message', (data) => {
      const m = JSON.parse(data.toString());
      if (m?.HED?.msgTyp === 1) {
        clearTimeout(t);
        session = {
          loginId: String(m.HED.loginId),
          instId: String(m.DAT.instId ?? '1'),
          sessionId: m.HED.sesnId,
          routeId: String(m.DAT.routeId ?? ''),
          customerId: String(m.DAT.customerId),
        };
        resolve();
      }
    });
    ws.on('error', (e) => { clearTimeout(t); reject(e); });
  });

  // Fetch customer details to get tradingAccId
  const custResp = await request(ws, session, 6, { customerId: session.customerId }, responses);
  const dseAcc = custResp?.DAT?.tradingAccounts?.find(a => a.exchange === 'DSE');
  const tradingAccId = dseAcc?.tradingAccId ?? 46985;
  console.log('Using DSE tradingAccId:', tradingAccId);

  // Try ordCatgry 0, 1, 2, 3
  for (const cat of [0, 1, 2, 3]) {
    const resp = await request(ws, session, 23, { tradingAccId, ordCatgry: cat }, responses, 5000);
    const lst = resp?.DAT?.ordLst ?? [];
    const statuses = [...new Set(lst.map(o => o.ordSts ?? o.status))];
    console.log(`ordCatgry=${cat}: ${lst.length} orders, statuses: ${JSON.stringify(statuses)}`);
    if (lst.length > 0) {
      console.log('  Sample:', JSON.stringify(lst[0]).slice(0, 200));
    }
  }

  ws.close();
}

function request(ws, session, msgTyp, dat, responses, timeout = 10000) {
  return new Promise((resolve) => {
    const m = JSON.parse(msg(msgTyp, session, dat));
    const reqId = m.HED.unqReqId;
    const t = setTimeout(() => { resolve(null); }, timeout);

    ws.on('message', function handler(data) {
      const resp = JSON.parse(data.toString());
      if (resp?.HED?.unqReqId === reqId || (resp?.HED?.msgTyp === msgTyp && !resp?.HED?.unqReqId)) {
        clearTimeout(t);
        ws.removeListener('message', handler);
        resolve(resp);
      }
    });
    ws.send(JSON.stringify(m));
  });
}

run().catch(console.error);
