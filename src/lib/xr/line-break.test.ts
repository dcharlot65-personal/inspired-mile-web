/**
 * The theatre's panels break lines only where the scripts allow (./line-break): every string of
 * the Japanese, Chinese and Thai interfaces and every verse of those packs, cut the way a panel may
 * cut it. The rules are written out again here from JIS X 4051 / JLREQ (kinsoku) rather than
 * imported, so the test does not agree with the module by construction.
 */
import { describe, expect, it } from 'vitest';
import { breakPoints, lineBreakFault } from './line-break';
import ja from '../../i18n/locales/ja';
import zh from '../../i18n/locales/zh';
import th from '../../i18n/locales/th';
import en from '../../i18n/locales/en';
import { getPack, loadPack } from '../verse/packs';

/** Never at the start of a line: closing brackets and quotes, the comma, the full stop, marks that lean on what is before. */
const NEVER_FIRST = new Set([...'、。，．,.」』）〕］｝〉》】〙〗”’)]}！？!?：；:;・ーゝゞヽヾ々ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ…‥％ๆฯ']);
/** Never at the end of a line: opening brackets and quotes. */
const NEVER_LAST = new Set([...'「『（〔［｛〈《【〘〖“‘([{']);

function faults(line: string, pieces: string[]): string[] {
  const out: string[] = [];
  if (pieces.join('') !== line) out.push(`pieces do not rebuild the line: ${JSON.stringify(pieces)}`);
  pieces.forEach((p, i) => {
    const first = p.trimStart()[0];
    const last = p.trimEnd().at(-1);
    if (i > 0 && first && NEVER_FIRST.has(first)) out.push(`"${first}" would open a line: ${JSON.stringify(pieces.slice(Math.max(0, i - 1), i + 1))}`);
    if (i < pieces.length - 1 && last && NEVER_LAST.has(last)) out.push(`"${last}" would close a line: ${JSON.stringify(pieces.slice(i, i + 2))}`);
  });
  return out;
}

async function texts(lang: 'ja' | 'zh' | 'th'): Promise<string[]> {
  const ui = { ja, zh, th }[lang];
  await loadPack(lang);
  const pack = getPack(lang);
  const verses = [...Object.values(pack.written).flat(), ...Object.values(pack.spare ?? {}).flat()];
  return [...Object.values(ui), ...verses].flatMap((s) => s.split('\n')).filter((s) => s.trim().length > 0);
}

describe('theatre line breaking', () => {
  for (const lang of ['ja', 'zh', 'th'] as const) {
    it(`${lang}: no piece opens with closing punctuation or ends with an opening bracket, and the pieces rebuild every line`, async () => {
      const lines = await texts(lang);
      expect(lines.length).toBeGreaterThan(300);
      const found = lines.flatMap((l) => faults(l, breakPoints(l)));
      expect(found.slice(0, 10)).toEqual([]);
      // Without a segmenter (an old browser) the same rules hold.
      const plain = lines.flatMap((l) => faults(l, breakPoints(l, null)));
      expect(plain.slice(0, 10)).toEqual([]);
    });
  }

  it('the lines the check saw: "。" and "（" stay with their words', () => {
    const line = '詩は自分の言葉で書くこと。（相手の詩を写すと無効）';
    const pieces = breakPoints(line);
    expect(faults(line, pieces)).toEqual([]);
    expect(pieces).toContain('こと。');
    expect(pieces.some((p) => p.startsWith('（'))).toBe(true);
    // Thai: the repetition mark stays with the word it repeats.
    expect(breakPoints('เด็กๆ เล่นกัน').some((p) => p.startsWith('ๆ'))).toBe(false);
  });

  it('still breaks where it may: between words, with spaces kept after the word, in English as before', () => {
    expect(breakPoints('Thy verse, my lord, is thin')).toEqual(['Thy ', 'verse, ', 'my ', 'lord, ', 'is ', 'thin']);
    expect(breakPoints('お前の詩は細い').length).toBeGreaterThan(2);
    for (const l of Object.values(en)) expect(faults(l, breakPoints(l))).toEqual([]);
  });

  it('lineBreakFault reads a pair of drawn lines the same way', () => {
    expect(lineBreakFault('お前の詩は細い', '。舞台')).not.toBeNull();
    expect(lineBreakFault('相手の詩を写すと（', '無効）')).not.toBeNull();
    expect(lineBreakFault('お前の詩は細い。', '舞台は')).toBeNull();
  });
});
