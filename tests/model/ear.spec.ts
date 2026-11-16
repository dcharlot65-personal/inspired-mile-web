import { test, expect } from '@playwright/test';

/**
 * Speech to text on the device. Chromium is started with a recorded phrase as
 * its microphone (see playwright.model.config.ts), the player taps the mic
 * twice, and Whisper's transcript must land in the verse box.
 */
test('a spoken verse is transcribed on the device into the verse box', async ({ page }) => {
  test.skip(!process.env.FAKE_MIC_WAV, 'needs FAKE_MIC_WAV: a WAV file used as the microphone');
  await page.addInitScript(() => localStorage.setItem('inspired-mile-age-verified', 'adult'));
  const remote: string[] = [];
  page.on('request', (r) => { if (/speech|google\.com\/speech-api|stt/i.test(r.url())) remote.push(r.url()); });

  await page.goto('/battle?seed=11&brain=rules');
  await page.click('#start-duel');
  await expect(page.locator('#opponent-verse')).toHaveAttribute('data-source', 'written');
  await page.click('[data-char-id]:not(.pointer-events-none)');

  await page.click('#mic-btn');
  await expect(page.locator('#mic-label')).toHaveText(/Listening/, { timeout: 3 * 60 * 1000 });
  await page.waitForTimeout(6000);
  await page.click('#mic-btn');
  await expect(page.locator('#mic-label')).toHaveText('Speak it', { timeout: 2 * 60 * 1000 });

  const heard = (await page.locator('#verse-input').inputValue()).toLowerCase();
  console.log(`[ear] transcript: ${JSON.stringify(heard)}`);
  expect(heard).toContain('question');
  expect(heard).toContain('stage');
  expect(remote, 'no speech service may be called').toEqual([]);
});
