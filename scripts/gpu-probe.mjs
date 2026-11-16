// Does this machine's Playwright Chromium expose a real WebGPU adapter? node scripts/gpu-probe.mjs
import { chromium } from '@playwright/test';
for (const [label, opts] of [
  ['headless', { headless: true, args: ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal'] }],
  ['headless-chromium-channel', { headless: true, channel: 'chromium', args: ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal'] }],
]) {
  try {
    const b = await chromium.launch(opts);
    const p = await b.newPage();
    await p.goto('https://sonnetman.inspiredmile.com/about');
    const info = await p.evaluate(async () => {
      if (!navigator.gpu) return 'no navigator.gpu';
      const a = await navigator.gpu.requestAdapter();
      if (!a) return 'no adapter';
      const i = a.info ?? {};
      return `${i.vendor} | ${i.architecture} | ${i.description} | f16=${a.features.has('shader-f16')} | maxBuf=${a.limits.maxBufferSize}`;
    });
    console.log(label, '=>', info);
    await b.close();
  } catch (e) { console.log(label, 'ERR', String(e).slice(0, 200)); }
}
