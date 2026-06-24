#!/usr/bin/env node
/**
 * Captures WebSocket frames (send + receive) during EasyTrade login.
 * Run this, log in manually, then close the browser.
 * Output saved to scripts/ws-frames.json
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'ws-frames.json');

const DEVICE = {
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
};

const frames = [];

async function main() {
  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
  const context = await browser.newContext(DEVICE);
  const page = await context.newPage();

  // Intercept WebSocket frames via CDP
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');

  // Track WS connections
  const wsSessions = {};
  cdp.on('Network.webSocketCreated', ({ requestId, url }) => {
    console.log(`WS CREATED: ${url} (id=${requestId})`);
    wsSessions[requestId] = { url, frames: [] };
  });
  cdp.on('Network.webSocketHandshakeResponseReceived', ({ requestId }) => {
    console.log(`WS OPEN: id=${requestId}`);
  });
  cdp.on('Network.webSocketFrameSent', ({ requestId, timestamp, response }) => {
    const f = { dir: 'SEND', ts: timestamp, payload: response.payloadData };
    wsSessions[requestId]?.frames.push(f);
    frames.push({ url: wsSessions[requestId]?.url, ...f });
    console.log(`SEND [${requestId}]: ${response.payloadData.substring(0, 200)}`);
  });
  cdp.on('Network.webSocketFrameReceived', ({ requestId, timestamp, response }) => {
    const f = { dir: 'RECV', ts: timestamp, payload: response.payloadData };
    wsSessions[requestId]?.frames.push(f);
    frames.push({ url: wsSessions[requestId]?.url, ...f });
    console.log(`RECV [${requestId}]: ${response.payloadData.substring(0, 200)}`);
  });
  cdp.on('Network.webSocketClosed', ({ requestId }) => {
    console.log(`WS CLOSED: id=${requestId}`);
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Log in to EasyTrade in the browser');
  console.log('Then close the browser window.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await page.goto('https://easytrade.shantasecurities.com/mob/', { waitUntil: 'domcontentloaded' });

  await new Promise(resolve => browser.on('disconnected', resolve));

  fs.writeFileSync(OUT, JSON.stringify({ sessions: wsSessions, allFrames: frames }, null, 2));
  console.log(`\nSaved ${frames.length} frames to ${OUT}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
