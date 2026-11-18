#!/usr/bin/env node
// What the files a page received weigh compressed, as a server that compresses would send them.
//
//   node scripts/compressed-bytes.mjs <dist> <list.json>...
//
// Each list is what tests/battle-bytes.spec.ts writes with BYTES_OUT: [path, body bytes] per
// response. For each path found in <dist>: its size on disk, gzip -9 and brotli (quality 11)
// sizes; a file already compressed on disk (".gz") counts as it is. Paths not in <dist> (the dev
// server's, the API's) are counted separately.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';

const [dist, ...lists] = process.argv.slice(2);
for (const list of lists) {
  const rows = JSON.parse(readFileSync(list, 'utf8'));
  const t = { files: 0, body: 0, disk: 0, gzip: 0, brotli: 0, missing: 0, missingBody: 0 };
  for (const [path, body] of rows) {
    let file = join(dist, decodeURIComponent(path));
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) {
      if (existsSync(`${file}.html`)) file = `${file}.html`;
      else {
        t.missing++;
        t.missingBody += body;
        continue;
      }
    }
    const buf = readFileSync(file);
    t.files++;
    t.body += body;
    t.disk += buf.length;
    if (/\.gz$/.test(file)) {
      t.gzip += buf.length;
      t.brotli += buf.length;
    } else {
      t.gzip += gzipSync(buf, { level: 9 }).length;
      t.brotli += brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length;
    }
  }
  console.log(`MEASURE compressed ${list.split('/').pop()} ${JSON.stringify(t)}`);
}
