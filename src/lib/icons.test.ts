// The game's icons: one master drawing (design/icon/), rendered by scripts/build-icons.sh into
// public/icons/<index>/, a new folder each time it changes (the owner's naming rule). These tests
// fail if the page, the manifest and the service worker stop agreeing on that folder, if a file
// they name is missing or the wrong size, or if a master picks up text or an outside source.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p));
const text = (p: string) => read(p).toString('utf8');

const ICON_PATH = /\/icons\/(\d{14})\/[A-Za-z0-9.-]+/g;

function iconPaths(source: string): string[] {
  return [...source.matchAll(ICON_PATH)].map((m) => m[0]);
}

function pngSize(bytes: Buffer): [number, number] {
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

const folders = readdirSync(join(ROOT, 'public', 'icons'))
  .filter((n) => /^\d{14}$/.test(n))
  .sort();
const newest = folders[folders.length - 1];

const layout = iconPaths(text('src/layouts/BaseLayout.astro'));
const manifest = JSON.parse(text('public/manifest.json')) as { icons: { src: string; sizes: string; type: string; purpose: string }[] };
const sw = iconPaths(text('public/sw.js'));

describe('the icons the site names', () => {
  it('all live in the newest icon folder', () => {
    expect(newest, 'no public/icons/<index>/ folder').toBeTruthy();
    const all = [...layout, ...manifest.icons.map((i) => i.src), ...sw];
    expect(layout.length).toBe(3);
    expect(sw.length).toBe(3);
    for (const p of all) expect(p, p).toMatch(new RegExp(`^/icons/${newest}/`));
  });

  it('exist, and each picture is the size the manifest says', () => {
    for (const p of [...layout, ...sw]) expect(existsSync(join(ROOT, 'public', p)), p).toBe(true);
    for (const icon of manifest.icons) {
      const file = join('public', icon.src);
      expect(existsSync(join(ROOT, file)), icon.src).toBe(true);
      if (icon.type === 'image/png') {
        const [w, h] = pngSize(read(file));
        expect(`${w}x${h}`, icon.src).toBe(icon.sizes);
      }
    }
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
    expect(pngSize(read(`public/icons/${newest}/apple-touch-icon.png`))).toEqual([180, 180]);
  });

  it('keeps a favicon.ico with 16, 32 and 48 pixel pictures', () => {
    const ico = read(`public/icons/${newest}/favicon.ico`);
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    const count = ico.readUInt16LE(4);
    const sizes = Array.from({ length: count }, (_, i) => ico[6 + 16 * i] || 256);
    expect(sizes.sort((a, b) => a - b)).toEqual([16, 32, 48]);
  });

  it('serves the same art at the two fixed names browsers and iOS ask for by default', () => {
    expect(read('public/favicon.ico').equals(read(`public/icons/${newest}/favicon.ico`))).toBe(true);
    expect(read('public/apple-touch-icon.png').equals(read(`public/icons/${newest}/apple-touch-icon.png`))).toBe(true);
  });

  it('draws the masters with no text, no font and nothing from outside', () => {
    for (const name of ['mark-small.svg', 'mark-full.svg', 'mark-apple.svg', 'mark-maskable.svg']) {
      const svg = text(join('design', 'icon', name));
      expect(svg, name).not.toMatch(/<text|font-family|@import|href="http|xlink:href="http|url\(http/i);
    }
    expect(text(`public/icons/${newest}/favicon.svg`)).toBe(text('design/icon/mark-small.svg'));
  });
});
