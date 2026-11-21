/**
 * The Terms of Service and the policy pages, where they meet the licenses of what others made (/credits) and
 * the owner's standing rule on the public contact address.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

describe('the Terms of Service and third-party material', () => {
  const terms = read('src/pages/terms.astro');
  it('leaves what others made to its own license, and restricts none of it', () => {
    const para = terms.slice(terms.indexOf('id="third-party"'), terms.indexOf('</p>', terms.indexOf('id="third-party"')));
    expect(para).toContain('href="/credits"');
    expect(para).toContain('nothing in these Terms restricts what that license allows you to do with that material');
    // The licenses it names as examples are ones the site ships material under: the notices file carries each.
    // (It named the GNU GPL while eSpeak NG shipped inside the voice; since the voice reads English itself, nothing does.)
    const examples = para.match(/\(such as ([^)]*)\)/)?.[1] ?? '';
    expect(examples).toContain('CC BY-SA 4.0');
    const notices = read('public/licenses/THIRD-PARTY-NOTICES.txt');
    for (const [name, text] of [['CC BY-SA 4.0', 'CC BY-SA 4.0'], ['GNU General Public License', 'GNU General Public License'], ['GPL', 'GNU General Public License']]) {
      if (examples.includes(name)) expect([name, notices.includes(text)]).toEqual([name, true]);
    }
    // EDRDG's licence statement: "Users of material from the files must NOT claim copyright over that material."
    expect(para).toContain('we claim no copyright over them or over what our own works take from them');
    expect(para).toMatch(/JMdict and JMnedict, for one, stay the copyright of James William Breen and the Electronic Dictionary Research and Development Group/);
    // The reverse-engineering ban says it does not reach third-party material.
    expect(terms).toMatch(/reverse-engineer the Service or its game mechanics \(this does not limit what the license of any third-party material/);
  });
});

describe('the public contact address', () => {
  it('is contact@voyagetracable.com on the pages that give one', () => {
    for (const p of ['privacy', 'terms', 'credits']) {
      const text = read(`src/pages/${p}.astro`);
      expect([p, [...text.matchAll(/mailto:([^"]+)"/g)].map((m) => m[1])]).toEqual([p, ['contact@voyagetracable.com']]);
    }
  });
});

