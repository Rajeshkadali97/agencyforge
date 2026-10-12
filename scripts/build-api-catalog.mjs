#!/usr/bin/env node
// Builds runtime/src/missions/data/public-apis.json from the README of
// https://github.com/public-apis/public-apis (MIT licensed).
//
//   node scripts/build-api-catalog.mjs path/to/public-apis/README.md
//
// Output entries: { name, description, category, auth, https, cors, url }

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const input = process.argv[2];
if (!input) {
  console.error('usage: node scripts/build-api-catalog.mjs <public-apis/README.md>');
  process.exit(1);
}

const out = resolve(here, '../runtime/src/missions/data/public-apis.json');
const lines = readFileSync(input, 'utf8').split(/\r?\n/);

// Only the "### Category" sections after the Index contain API tables.
const entries = [];
const seen = new Set();
let category = null;
let inIndex = true;

const rowRe = /^\|\s*\[([^\]]+)\]\(([^)\s]+)\)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|/;

for (const line of lines) {
  if (/^## Index/.test(line)) { inIndex = true; continue; }
  const h = /^### (.+?)\s*$/.exec(line);
  if (h) {
    category = h[1].replace(/\s*\^?\[?.*Back to Index.*$/i, '').trim();
    inIndex = false;
    continue;
  }
  if (inIndex || !category) continue;
  const m = rowRe.exec(line);
  if (!m) continue;
  const [, name, url, description, authRaw, httpsRaw, corsRaw] = m;
  if (!/^https?:\/\//.test(url)) continue;
  const auth = authRaw.replace(/`/g, '').trim();
  const authNorm = /^no$/i.test(auth) ? 'none' : auth || 'unknown';
  const https = /^yes$/i.test(httpsRaw.trim());
  const cors = /^yes$/i.test(corsRaw.trim()) ? 'yes' : /^no$/i.test(corsRaw.trim()) ? 'no' : 'unknown';
  const key = `${category}|${name}|${url}`;
  if (seen.has(key)) continue;
  seen.add(key);
  entries.push({ name: name.trim(), description: description.trim(), category, auth: authNorm, https, cors, url });
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(entries));
const cats = new Set(entries.map((e) => e.category));
const free = entries.filter((e) => e.auth === 'none' && e.https).length;
console.log(`wrote ${entries.length} APIs in ${cats.size} categories (${free} free + HTTPS) -> ${out}`);
