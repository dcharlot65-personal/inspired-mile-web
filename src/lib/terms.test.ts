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
    expect(para).toMatch(/CC BY-SA 4\.0 and the GNU General Public License/);
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

