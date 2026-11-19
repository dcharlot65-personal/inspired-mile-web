#!/usr/bin/env node
/**
 * Record every translated string as it stands at a git ref, so the report can
 * say exactly what this work changed (and not count a change that came from
 * elsewhere, such as a merge from main).
 *
 *   node scripts/lang/baseline.mjs [ref]      default: main; writes docs/language/baseline.json
 *
 * It copies this checkout's src/ and scripts/lang into a temporary folder, lays
 * that ref's string files over them (src/i18n/locales/, src/lib/verse/packs/,
 * src/lib/verse/english.ts, which holds the English of the engine's messages:
 * data only), and reads the strings there with the same code the checks use. The
 * ref's own code is not used: older code may lack what the reader needs.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ref = process.argv[2] ?? 'main';
const commit = execFileSync('git', ['-C', ROOT, 'rev-parse', ref], { encoding: 'utf8' }).trim();
const dir = mkdtempSync(join(tmpdir(), 'langqa-baseline-'));
try {
  cpSync(join(ROOT, 'src'), join(dir, 'src'), { recursive: true });
  cpSync(join(ROOT, 'scripts/lang'), join(dir, 'scripts/lang'), { recursive: true });
  rmSync(join(dir, 'src/i18n/locales'), { recursive: true });
  execFileSync('sh', ['-c', `git -C "${ROOT}" archive ${commit} src/i18n/locales src/lib/verse/packs src/lib/verse/english.ts | tar -x -C "${dir}"`]);
  execFileSync(process.execPath, [join(dir, 'scripts/lang/extract.mjs'), join(dir, 'strings.json')], { stdio: 'inherit' });
  const strings = JSON.parse(readFileSync(join(dir, 'strings.json'), 'utf8'));
  const out = { ref, commit, made: new Date().toISOString(), note: 'Every interface string (ui) and player-facing pack string (pack) per language, as at this commit. scripts/lang/report.mjs reports changes against it.', strings };
  writeFileSync(join(ROOT, 'docs/language/baseline.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(`docs/language/baseline.json: ${ref} = ${commit}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
