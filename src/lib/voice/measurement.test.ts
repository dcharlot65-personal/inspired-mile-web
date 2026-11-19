import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import lexicon from './lexicon-en';
import { installVoiceLexicon, phonemizeEnglish, splitForKokoro } from './g2p-en';

/**
 * docs/voice/G2P-MEASUREMENT.md says how the voice is heard, from docs/voice/measurement.json
 * (scripts/voice/measure.mjs). That is true only of the code that was measured. Kokoro and
 * Whisper are deterministic here, so what decides the new reading is the phonemes it is given:
 * every text's recorded phonemes must be what g2p-en.ts gives for it now, exactly as readAloud()
 * hands them to Kokoro (British, cut by splitForKokoro, joined by a space).
 *
 * When this fails, the G2P (or its table) changed after the measurement. Measure again on the
 * build host and commit the new results with the tables:
 *   node --import ./scripts/sound/ts-resolve.mjs scripts/voice/measure.mjs   (about 40 minutes)
 *   node scripts/voice/report.mjs --write
 * VOICE_MEASUREMENT=<file> checks another results file (docs/voice/measurement-run1.json, of
 * older code, must fail).
 */

const FILE = process.env.VOICE_MEASUREMENT || 'docs/voice/measurement.json';

interface Row {
  id: string;
  text: string;
  new: { phonemes: string };
}

beforeAll(() => installVoiceLexicon(lexicon));

describe(`the measurement (${FILE}) is of this code`, () => {
  const rows: Row[] = JSON.parse(readFileSync(FILE, 'utf8')).results;

  it('has every text of the corpus it reports on', () => {
    expect(rows.length).toBeGreaterThanOrEqual(400);
  });

  it('gave Kokoro the phonemes g2p-en.ts gives now, for every text', () => {
    const stale = rows
      .map((r) => ({ id: r.id, measured: r.new.phonemes, now: splitForKokoro(phonemizeEnglish(r.text, { british: true }).ps).join(' ') }))
      .filter((r) => r.measured !== r.now);
    expect(stale.slice(0, 10), `${stale.length} of ${rows.length} texts read differently now; measure again (header of this file)`).toEqual([]);
  });
});
