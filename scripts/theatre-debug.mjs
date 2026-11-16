// Debug aid: screenshot the theatre, or with XR=1 run it under an emulated Quest 3 and print page errors with stacks.
import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
p.on('pageerror', (e) => console.log('PAGEERROR', (e.stack ?? e.message).split('\n').slice(0, 8).join('\n   ')));
await p.addInitScript(() => localStorage.setItem('inspired-mile-age-verified', 'adult'));
if (process.env.XR) {
  await p.addInitScript({ path: 'node_modules/iwer/build/iwer.min.js' });
  await p.addInitScript(() => { delete Navigator.prototype.xr; const d = new IWER.XRDevice(IWER.metaQuest3); d.installRuntime(); window.__xrDevice = d; });
}
await p.goto('http://localhost:4399/theatre?seed=11&brain=rules');
await p.waitForFunction(() => window.__theatre?.session?.phase === 'player-turn');
await p.waitForTimeout(1500);
if (process.env.XR) {
  await p.click('#enter-xr');
  await p.waitForTimeout(3000);
  console.log('mode', await p.evaluate(() => window.__theatre.theatre.mode));
}
await p.locator('#theatre-canvas').screenshot({ path: '/tmp/im-theatre.png' });
await b.close();
