/**
 * What the site says about its own pages (owner decision D-03, 2026-11-19): the sitemap lists every
 * page there is and none that is not (it listed /trivia/ and /challenges/, which do not exist, and
 * left out the Theatre, the world map and both galleries), no link inside the site leads to a page
 * that does not exist, and the home page, which names the Theatre, links to it.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ORIGIN = 'https://sonnetman.inspiredmile.com';

/** The site's pages, as paths: src/pages/about.astro is /about/, index.astro is /. */
export function pagePaths(names: string[]): string[] {
  return names
    .filter((n) => n.endsWith('.astro') && !n.startsWith('_') && !n.includes('['))
    .map((n) => n.replace(/\.astro$/, ''))
    .map((n) => (n === 'index' ? '/' : `/${n}/`))
    .sort();
}

/** The paths a sitemap lists. */
export function sitemapPaths(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim().replace(ORIGIN, '')).sort();
}

/** Where the site's own markup links, by path (assets and anchors aside). */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.(astro|ts)$/.test(name) && !name.endsWith('.test.ts') ? [full] : [];
  });
}
// Files the site serves, not pages: public/'s folders (the icons since fix/favicon, the license texts /credits links)
// and what the build adds (ort, vendor) or the API answers.
const ASSET = /^\/(?:favicon|manifest|fonts|apple-touch-icon|images|audio|models|icons?|licenses|ort|vendor|api)\b/;
function linkedPages(source: string): string[] {
  return [...source.matchAll(/(?:href|aHref)=["'`](\/[a-z0-9-]*)/g)].map((m) => m[1]).filter((p) => !ASSET.test(p));
}

const pages = pagePaths(readdirSync('src/pages'));
const sitemap = sitemapPaths(readFileSync('public/sitemap.xml', 'utf8'));

describe('the sitemap and the links name the pages there are', () => {
  it('reads what it checks (the scans work)', () => {
    expect(pages).toContain('/');
    expect(pages).toContain('/battle/');
    expect(pages.length).toBeGreaterThan(10);
    expect(sitemap).toContain('/');
    expect(sitemapPaths(`<loc>${ORIGIN}/trivia/</loc>`)).toEqual(['/trivia/']);
    expect(linkedPages('<a href="/theatre" class="x"><a href="/favicon.svg"><T aHref="/playground" />')).toEqual(['/theatre', '/playground']);
    expect(linkedPages('<link href="/icons/20261120100034/favicon.svg"><a href="/licenses/SCOWL-Copyright.txt"><a href="/credits">')).toEqual(['/credits']);
  });

  it('the sitemap lists every page, and no page that does not exist', () => {
    expect({ missing: pages.filter((p) => !sitemap.includes(p)), dead: sitemap.filter((p) => !pages.includes(p)) }).toEqual({ missing: [], dead: [] });
  });

  it('every link inside the site leads to a page that exists', () => {
    const dead: string[] = [];
    for (const file of [...sources('src/pages'), ...sources('src/layouts'), ...sources('src/components')]) {
      for (const p of linkedPages(readFileSync(file, 'utf8'))) {
        if (!pages.includes(p === '/' ? '/' : `${p.replace(/\/$/, '')}/`)) dead.push(`${file}: ${p}`);
      }
    }
    expect(dead).toEqual([]);
  });

  it('the home page links to the Theatre it names', () => {
    const home = readFileSync('src/pages/index.astro', 'utf8');
    const en = readFileSync('src/i18n/pages/home/en.ts', 'utf8');
    expect(en).toMatch(/in the Theatre/);
    expect(linkedPages(home)).toContain('/theatre');
  });
});
