// verify-matrix.mjs — the depth × theme ship gate for lnzh.org.
//
// Loads every page in BOTH themes in real Chrome (Playwright driving the
// installed Google Chrome) and fails on:
//   - console errors / page exceptions
//   - any same-origin request that comes back 4xx/5xx
//   - a relative url() inside a --*-src custom property (it resolves against
//     the stylesheet, not the page — the invisible-nav-star bug; CLAUDE.md)
//   - any computed background / mask / content / --*-src URL that doesn't
//     fetch 200 — the "paints nothing, logs nothing" class of bug
//   - the page not actually being in the theme we asked for
//
// Then (unless --no-lighthouse) runs a Lighthouse accessibility audit
// (contrast, focus, names/labels) per page × theme through the SAME browser
// profile, so the localStorage theme sticks. A11y findings are reported but
// only fail the exit code with --strict-a11y; the matrix checks always gate.
//
//   cd dev && npm install                                  # once
//   ./serve 8000                                           # in another shell
//   node dev/verify-matrix.mjs                             # full gate
//   node dev/verify-matrix.mjs --base http://localhost:8123
//   node dev/verify-matrix.mjs --pages /,/writing/ --no-lighthouse   # quick loop
//
// Screenshots land in /tmp/lnzh-verify/. Exit 0 = green, 1 = something to fix.

import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

// ---- args -----------------------------------------------------------------
const argv = process.argv.slice(2);
const flag = (name) => {
    const i = argv.indexOf(name);
    if (i === -1) return undefined;
    argv.splice(i, 1);
    return true;
};
const opt = (name, fallback) => {
    const i = argv.indexOf(name);
    if (i === -1) return fallback;
    const v = argv[i + 1];
    argv.splice(i, 2);
    return v;
};

const BASE = (opt('--base', 'http://localhost:8000')).replace(/\/$/, '');
// One page per path depth: home (0), a section page (1), a deep page (2).
const PAGES = (opt('--pages', '/,/writing/,/blog/tomato/')).split(',').map((p) => p.trim()).filter(Boolean);
const THEMES = ['light', 'dark'];
const NO_LIGHTHOUSE = flag('--no-lighthouse');
const STRICT_A11Y = flag('--strict-a11y');
const SHOTS = opt('--screens', '/tmp/lnzh-verify');
const CDP_PORT = Number(opt('--cdp-port', '9777'));

const slug = (p) => p.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'home';

// Known-benign console noise that must not redden the gate. Keep this SHORT and
// specific — every entry is a bug we've consciously decided not to fix.
const CONSOLE_IGNORE = [
    // The X-Frame-Options <meta> on every page: browsers ignore XFO in meta form
    // (header-only per spec), so the tag is inert and Chrome logs this warning.
    // GitHub Pages can't send response headers, so there's no header to move it to.
    /X-Frame-Options may only be set via an HTTP header/,
];
const failures = [];
const warnings = [];
const a11yFindings = [];

// ---- browser ---------------------------------------------------------------
mkdirSync(SHOTS, { recursive: true });
const context = await chromium.launchPersistentContext('', {
    channel: 'chrome',
    headless: true,
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2,
    args: [`--remote-debugging-port=${CDP_PORT}`, '--hide-scrollbars'],
});

try {
    // Make sure the server is actually up before blaming pages.
    try {
        await fetch(BASE + '/');
    } catch {
        console.error(`Nothing is serving ${BASE} — run ./serve first.`);
        process.exit(1);
    }

    for (const theme of THEMES) {
        const page = await context.newPage();

        // Buffers the listeners write into; reset per page visit.
        let consoleErrors = [];
        let badResponses = [];
        let failedRequests = [];
        page.on('console', (m) => {
            if (m.type() === 'error' && !CONSOLE_IGNORE.some((re) => re.test(m.text()))) consoleErrors.push(m.text());
        });
        page.on('pageerror', (e) => consoleErrors.push(String(e)));
        page.on('response', (r) => { if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`); });
        page.on('requestfailed', (r) => failedRequests.push(`${r.failure()?.errorText ?? 'failed'} ${r.url()}`));

        // Seed the theme for this origin, then visit every page with it.
        await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
        await page.evaluate((t) => localStorage.setItem('theme', t), theme);

        for (const path of PAGES) {
            const url = BASE + path;
            const label = `${path} [${theme}]`;
            consoleErrors = [];
            badResponses = [];
            failedRequests = [];

            try {
                await page.goto(url, { waitUntil: 'load', timeout: 20000 });
            } catch (e) {
                failures.push(`${label} — page did not load: ${e.message}`);
                continue;
            }
            await page.waitForTimeout(1200); // let JS-applied assets paint

            const actualTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
            if (actualTheme !== theme) failures.push(`${label} — expected data-theme="${theme}", got "${actualTheme}"`);

            // Sweep every computed style for URLs the network log may have missed,
            // and flag relative url() values inside --*-src custom properties.
            const sweep = await page.evaluate(() => {
                const urls = new Set();
                const relativeSrcProps = [];
                const grab = (v) => {
                    if (!v || typeof v !== 'string') return;
                    for (const m of v.matchAll(/url\((['"]?)([^)'"]+)\1\)/g)) {
                        const u = m[2];
                        if (u && !u.startsWith('data:')) urls.add(new URL(u, document.baseURI).href);
                    }
                };
                // Collect every --*-src property name declared in any stylesheet.
                const srcProps = new Set();
                for (const sheet of document.styleSheets) {
                    let rules;
                    try { rules = sheet.cssRules; } catch { continue; }
                    for (const rule of rules) {
                        for (const m of (rule.cssText || '').matchAll(/--[\w-]*-src/g)) srcProps.add(m[0]);
                    }
                }
                const els = [document.documentElement, ...document.querySelectorAll('*')];
                for (const el of els) {
                    for (const pseudo of [null, '::before', '::after']) {
                        const cs = getComputedStyle(el, pseudo);
                        grab(cs.backgroundImage);
                        grab(cs.maskImage);
                        grab(cs.webkitMaskImage);
                        grab(cs.borderImageSource);
                        grab(cs.listStyleImage);
                        grab(cs.content);
                        if (!pseudo) {
                            for (const p of srcProps) {
                                const v = cs.getPropertyValue(p).trim();
                                if (!v) continue;
                                grab(v);
                                const m = v.match(/url\((['"]?)([^)'"]+)\1\)/);
                                if (m && !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(m[2]) && !m[2].startsWith('/')) {
                                    relativeSrcProps.push(`${p}: ${m[2]} (on ${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.split(/\s+/).join('.') : ''})`);
                                }
                            }
                        }
                    }
                }
                for (const img of document.images) {
                    if (img.currentSrc) urls.add(img.currentSrc);
                    if (img.complete && img.currentSrc && img.naturalWidth === 0) {
                        relativeSrcProps.push(`broken <img>: ${img.currentSrc}`);
                    }
                }
                return { urls: [...urls], relativeSrcProps };
            });

            for (const bad of sweep.relativeSrcProps) {
                failures.push(`${label} — ${bad.startsWith('broken') ? bad : 'relative --*-src (resolves against the stylesheet, not the page): ' + bad}`);
            }

            // Fetch every same-origin URL the sweep found; 200 or it's a failure.
            const sameOrigin = sweep.urls.filter((u) => u.startsWith(BASE + '/'));
            const checks = await Promise.all(sameOrigin.map(async (u) => {
                try {
                    const r = await fetch(u);
                    r.body?.cancel?.();
                    return r.ok ? null : `${r.status} ${u}`;
                } catch (e) {
                    return `unfetchable (${e.message}) ${u}`;
                }
            }));
            for (const c of checks) if (c) failures.push(`${label} — asset: ${c}`);

            for (const r of badResponses) {
                (r.includes(BASE + '/') ? failures : warnings).push(`${label} — ${r.includes(BASE + '/') ? 'request' : 'external request'}: ${r}`);
            }
            for (const r of failedRequests) warnings.push(`${label} — request failed: ${r}`);
            for (const c of consoleErrors) failures.push(`${label} — console: ${c}`);

            await page.screenshot({ path: `${SHOTS}/${slug(path)}-${theme}.png` });
            console.log(`checked ${label} — ${sameOrigin.length} swept assets`);
        }
        await page.close();

        // ---- Lighthouse a11y pass, same profile so the theme sticks ----------
        if (!NO_LIGHTHOUSE) {
            for (const path of PAGES) {
                const label = `${path} [${theme}]`;
                let report;
                try {
                    const out = execFileSync('npx', [
                        '-y', 'lighthouse', BASE + path,
                        '--port', String(CDP_PORT),
                        '--only-categories=accessibility',
                        '--disable-storage-reset',
                        '--quiet',
                        '--output=json', '--output-path=stdout',
                    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
                    report = JSON.parse(out);
                } catch (e) {
                    warnings.push(`${label} — lighthouse did not run: ${e.message.split('\n')[0]}`);
                    continue;
                }
                const score = Math.round((report.categories?.accessibility?.score ?? 0) * 100);
                const failing = Object.values(report.audits || {}).filter(
                    (a) => a.score !== null && a.score < 1 && a.scoreDisplayMode === 'binary',
                );
                console.log(`lighthouse ${label} — a11y ${score}/100${failing.length ? `, ${failing.length} failing audit(s)` : ''}`);
                for (const a of failing) {
                    const nodes = (a.details?.items ?? [])
                        .map((i) => i.node?.selector)
                        .filter(Boolean)
                        .slice(0, 4);
                    a11yFindings.push(`${label} — ${a.id}: ${a.title}${nodes.length ? `\n      ${nodes.join('\n      ')}` : ''}`);
                }
            }
        }
    }
} finally {
    await context.close();
}

// ---- report -----------------------------------------------------------------
const block = (title, items) => {
    if (!items.length) return;
    console.log(`\n${title}`);
    for (const i of items) console.log(`  ✗ ${i}`);
};
block('FAILURES', failures);
block('A11Y FINDINGS', a11yFindings);
if (warnings.length) {
    console.log('\nwarnings (external / non-gating)');
    for (const w of warnings) console.log(`  ~ ${w}`);
}
console.log(`\nscreenshots: ${SHOTS}/`);
const red = failures.length + (STRICT_A11Y ? a11yFindings.length : 0);
console.log(red ? `\nNOT CLEAN — ${failures.length} failure(s), ${a11yFindings.length} a11y finding(s).` : `\nCLEAN — matrix green${a11yFindings.length ? `, but ${a11yFindings.length} a11y finding(s) above` : ' (a11y too)'}.`);
process.exit(red ? 1 : 0);
