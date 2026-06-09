// measure-iris.mjs — headless smoke-test + frame-pacing measure for the iris
// transition in dev/theme-demo.html. No deps: drives Chrome via the DevTools
// Protocol over Node's global WebSocket/fetch.
//
//   node dev/measure-iris.mjs
//
// Reports, for each renderer (canvas = the fix, dom = the old slow path):
//   - the on-page meter text (fps + worst frame)
//   - any console errors / page exceptions
// Caveat: headless uses software GL, so absolute fps is pessimistic vs a real
// GPU/Retina display — the CANVAS-vs-DOM *ratio* is the signal, plus "no errors".

import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FILE = 'file://' + join(process.cwd(), 'dev/theme-demo.html');
const PORT = 9223;
const userDataDir = mkdtempSync(join(tmpdir(), 'iris-chrome-'));

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${userDataDir}`, '--no-first-run', '--no-default-browser-check',
  '--window-size=1440,900', '--hide-scrollbars', FILE,
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWsUrl() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`);
      const tabs = await res.json();
      const page = tabs.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(100);
  }
  throw new Error('Chrome CDP did not come up');
}

function cdp(ws) {
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      errors.push('EXCEPTION: ' + (msg.params.exceptionDetails.exception?.description
        || msg.params.exceptionDetails.text));
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      errors.push('CONSOLE: ' + msg.params.args.map((a) => a.value ?? a.description).join(' '));
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const myId = ++id;
    pending.set(myId, { resolve, reject });
    ws.send(JSON.stringify({ id: myId, method, params }));
  });
  return { send, errors };
}

async function evalPromise(send, expr) {
  const r = await send('Runtime.evaluate', {
    expression: expr, awaitPromise: true, returnByValue: true,
  });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
}

// Click the iris button with a given renderer, wait for the meter to change.
const runExpr = (renderer) => `new Promise((resolve) => {
  const meter = () => document.getElementById('iris-meter');
  const before = meter() ? meter().textContent : '';
  document.getElementById('iris-renderer').value = ${JSON.stringify(renderer)};
  document.getElementById('btn-iris').click();
  const t0 = performance.now();
  const iv = setInterval(() => {
    const m = meter();
    if (m && m.textContent && m.textContent !== before) { clearInterval(iv); resolve(m.textContent); }
    else if (performance.now() - t0 > 9000) { clearInterval(iv); resolve('TIMEOUT'); }
  }, 80);
})`;

(async () => {
  const wsUrl = await getWsUrl();
  const ws = new WebSocket(wsUrl);
  await new Promise((res) => ws.addEventListener('open', res, { once: true }));
  const { send, errors } = cdp(ws);
  await send('Runtime.enable');
  await send('Page.enable');
  await sleep(600); // let the page build swatches/icons

  const canvas = await evalPromise(send, runExpr('canvas'));
  await sleep(400);
  const dom = await evalPromise(send, runExpr('dom'));

  console.log('--- iris frame-pacing (headless, software GL — ratio is the signal) ---');
  console.log('CANVAS (fix):', canvas);
  console.log('DOM (old)   :', dom);
  console.log('JS errors   :', errors.length ? errors : 'none');

  ws.close();
  chrome.kill('SIGKILL');
  process.exit(0);
})().catch((e) => { console.error('measure failed:', e.message); chrome.kill('SIGKILL'); process.exit(1); });
