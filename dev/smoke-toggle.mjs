// smoke-toggle.mjs — headless functional smoke for the PRODUCTION theme toggle
// on a real site page. Drives Chrome via the DevTools Protocol (no deps) to:
//   open index.html -> click the gear -> click the theme button (fires the iris)
//   -> assert data-theme flipped, the canvas mounted then unmounted, no errors.
//
//   node dev/smoke-toggle.mjs

import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
// Pass an http URL as argv[2] — the page's `script-src 'self'` CSP blocks
// subresources under file://, so the toggle only loads when served over HTTP.
const FILE = process.argv[2] || ('file://' + join(process.cwd(), 'index.html'));
const PORT = 9224;
const userDataDir = mkdtempSync(join(tmpdir(), 'iris-smoke-'));

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${userDataDir}`, '--no-first-run', '--no-default-browser-check',
  '--window-size=1440,900', '--hide-scrollbars', FILE,
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWsUrl() {
  for (let i = 0; i < 50; i++) {
    try {
      const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
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
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
}

const TEST = `new Promise((resolve) => {
  const before = document.documentElement.getAttribute('data-theme');
  const gear = document.querySelector('.theme-toggle-btn');
  if (!gear) { resolve({ error: 'no gear button', href: location.href, title: document.title,
    buttons: document.querySelectorAll('button').length,
    scripts: [...document.scripts].map((s) => s.src),
    dataTheme: document.documentElement.getAttribute('data-theme') }); return; }
  gear.click();
  const themeBtn = document.querySelector('.theme-theme-btn');
  if (!themeBtn) { resolve({ error: 'no theme button — panel did not open' }); return; }
  themeBtn.click();
  const canvasDuring = !!document.querySelector('canvas');   // appended synchronously
  setTimeout(() => resolve({
    before,
    after: document.documentElement.getAttribute('data-theme'),
    canvasDuring,
    canvasAfter: !!document.querySelector('canvas'),
  }), 2500);
})`;

(async () => {
  const ws = new WebSocket(await getWsUrl());
  await new Promise((res) => ws.addEventListener('open', res, { once: true }));
  const { send, errors } = cdp(ws);
  await send('Page.enable');
  await send('Runtime.enable');
  // Reload WITH the listeners attached so init-time exceptions are captured
  // (the toggle builds on DOMContentLoaded, before the first CDP connect).
  const loaded = new Promise((res) => {
    const h = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.method === 'Page.loadEventFired') { ws.removeEventListener('message', h); res(); }
    };
    ws.addEventListener('message', h);
  });
  await send('Page.reload', { ignoreCache: true });
  await loaded;
  await sleep(700); // let DOMContentLoaded build the toggle UI

  const r = await evalPromise(send, TEST);

  const ok = !r.error && r.before && r.after && r.before !== r.after
    && r.canvasDuring === true && r.canvasAfter === false && errors.length === 0;

  console.log('--- production theme toggle smoke (index.html, headless) ---');
  console.log(r.error ? ('ERROR: ' + r.error) : (
    `theme: ${r.before} -> ${r.after}  |  canvas mounted: ${r.canvasDuring}  |  ` +
    `canvas cleaned up: ${!r.canvasAfter}`));
  console.log('JS errors:', errors.length ? errors : 'none');
  console.log(ok ? 'RESULT: PASS ✅' : 'RESULT: FAIL ❌');

  ws.close();
  chrome.kill('SIGKILL');
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error('smoke failed:', e.message); chrome.kill('SIGKILL'); process.exit(1); });
