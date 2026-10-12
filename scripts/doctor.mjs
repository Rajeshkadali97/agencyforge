#!/usr/bin/env node
// AgencyForge doctor: checks that this machine can build and run the stack.
//   pnpm doctor

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'runtime/package.json'));

const results = [];
const record = (status, name, detail = '') => results.push({ status, name, detail });
const ok = (name, detail) => record('ok', name, detail);
const warn = (name, detail) => record('warn', name, detail);
const fail = (name, detail) => record('fail', name, detail);

// Node
const major = Number(process.versions.node.split('.')[0]);
major >= 20
  ? ok('Node.js', `v${process.versions.node}`)
  : fail('Node.js', `v${process.versions.node} — AgencyForge needs Node 20 or newer`);

// pnpm
try {
  const v = execSync('pnpm --version', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  ok('pnpm', `v${v}`);
} catch {
  fail('pnpm', 'not found — run `corepack enable`');
}

// dependencies + build output
existsSync(resolve(root, 'node_modules')) ? ok('Dependencies', 'installed') : fail('Dependencies', 'run `pnpm install`');
existsSync(resolve(root, 'runtime/dist/cli.js')) ? ok('Runtime build', 'runtime/dist/cli.js found') : fail('Runtime build', 'run `pnpm build`');
existsSync(resolve(root, 'dashboard/.next')) ? ok('Dashboard build', 'dashboard/.next found') : warn('Dashboard build', 'run `pnpm build` before `pnpm start:dashboard`');

// native sqlite binding
try {
  const Database = require('better-sqlite3');
  new Database(':memory:').close();
  ok('SQLite binding', 'better-sqlite3 loads');
} catch (err) {
  fail('SQLite binding', `${err instanceof Error ? err.message.split('\n')[0] : err} — run \`pnpm rebuild better-sqlite3\``);
}

// ports
function portFree(port) {
  return new Promise((done) => {
    const srv = createServer();
    srv.once('error', () => done(false));
    srv.once('listening', () => srv.close(() => done(true)));
    srv.listen(port, '127.0.0.1');
  });
}
for (const [port, label] of [[3000, 'Dashboard'], [3001, 'Runtime bridge'], [3002, 'Health server']]) {
  (await portFree(port))
    ? ok(`Port ${port}`, `${label} port is free`)
    : warn(`Port ${port}`, `in use — fine if AgencyForge is already running`);
}

// env
existsSync(resolve(root, '.env'))
  ? ok('.env', 'found')
  : warn('.env', 'not found — optional; copy .env.example to .env to add API keys');

// network
async function reach(url, timeoutMs = 4000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { 'User-Agent': 'AgencyForge-doctor' } });
    return r.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}
(await reach('https://en.wikipedia.org/api/rest_v1/'))
  ? ok('Internet', 'public APIs reachable (missions will return live data)')
  : warn('Internet', 'public APIs unreachable — missions need network access');
(await reach('http://localhost:20128/v1/models', 1500))
  ? ok('9Router gateway', 'reachable on localhost:20128')
  : warn('9Router gateway', 'not running — optional; start with `npx 9router` for free multi-provider routing');

// report
const icon = { ok: '✔', warn: '!', fail: '✖' };
const pad = Math.max(...results.map((r) => r.name.length));
console.log('\nAgencyForge doctor\n');
for (const r of results) console.log(` ${icon[r.status]}  ${r.name.padEnd(pad)}  ${r.detail}`);
const failures = results.filter((r) => r.status === 'fail').length;
const warnings = results.filter((r) => r.status === 'warn').length;
console.log(`\n${failures === 0 ? 'Ready to go.' : `${failures} problem(s) to fix.`}${warnings ? ` ${warnings} note(s).` : ''}\n`);
process.exit(failures === 0 ? 0 : 1);
