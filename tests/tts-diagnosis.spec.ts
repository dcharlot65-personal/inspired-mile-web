import { test, expect } from '@playwright/test';

/**
 * TTS Diagnosis Test
 *
 * Tests the battle page to verify TTS audio is triggered.
 * Traces: voice loading → speak() calls → audio playback.
 */

test.describe('TTS Audio', () => {
  test('speaks AI opening verse in demo mode', async ({ page }) => {
    const logs: string[] = [];
    let audioPlayCalled = false;
    let speechSynthCalled = false;

    page.on('console', (msg) => {
      logs.push(`[${msg.type()}] ${msg.text()}`);
    });

    // Intercept audio play attempts
    await page.addInitScript(() => {
      const origPlay = HTMLAudioElement.prototype.play;
      HTMLAudioElement.prototype.play = function () {
        console.log('[TTS-DIAG] Audio.play() called');
        (window as any).__audioPlayCalled = true;
        return origPlay.call(this).catch((err: Error) => {
          console.log(`[TTS-DIAG] Audio.play() error: ${err.message}`);
          throw err;
        });
      };

      if (window.speechSynthesis) {
        const origSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);
        window.speechSynthesis.speak = function (utt: SpeechSynthesisUtterance) {
          console.log(`[TTS-DIAG] speechSynthesis.speak() called: "${utt.text?.substring(0, 50)}..."`);
          (window as any).__speechSynthCalled = true;
          return origSpeak(utt);
        };
      }

      (window as any).__audioPlayCalled = false;
      (window as any).__speechSynthCalled = false;
    });

    await page.goto('http://localhost:4399/battle', { waitUntil: 'networkidle' });

    // Wait for WebGPU check
    await page.waitForTimeout(3000);

    // Enter demo mode (headless Chrome has no WebGPU)
    const noWebgpu = page.locator('#no-webgpu');
    if (await noWebgpu.isVisible()) {
      await page.click('#fallback-mode-btn');
      await page.waitForTimeout(500);
    }

    // Click arena to init audio context
    await page.click('#battle-arena');
    await page.waitForTimeout(300);

    // Select freestyle mode — should trigger AI opening verse + TTS
    await page.click('[data-mode="freestyle"]');

    // Wait for the demo response + speak call
    await page.waitForTimeout(3000);

    // Check if any audio method was called
    const result = await page.evaluate(() => ({
      audioPlayCalled: (window as any).__audioPlayCalled,
      speechSynthCalled: (window as any).__speechSynthCalled,
    }));

    // Print diagnostic logs
    const ttsLogs = logs.filter(l => l.includes('TTS-DIAG'));
    console.log('\n=== TTS DIAGNOSTIC ===');
    ttsLogs.forEach(l => console.log(l));
    console.log(`Audio.play() called: ${result.audioPlayCalled}`);
    console.log(`speechSynthesis.speak() called: ${result.speechSynthCalled}`);

    // At least one TTS method should have been called
    expect(result.audioPlayCalled || result.speechSynthCalled).toBe(true);
  });

  test('speaks AI response after player input in demo mode', async ({ page }) => {
    const logs: string[] = [];

    page.on('console', (msg) => {
      logs.push(`[${msg.type()}] ${msg.text()}`);
    });

    await page.addInitScript(() => {
      const origPlay = HTMLAudioElement.prototype.play;
      HTMLAudioElement.prototype.play = function () {
        console.log('[TTS-DIAG] Audio.play() called');
        (window as any).__audioPlayCalled = true;
        return origPlay.call(this).catch((err: Error) => {
          console.log(`[TTS-DIAG] Audio.play() error: ${err.message}`);
          throw err;
        });
      };

      if (window.speechSynthesis) {
        const origSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);
        window.speechSynthesis.speak = function (utt: SpeechSynthesisUtterance) {
          console.log(`[TTS-DIAG] speechSynthesis.speak() called: "${utt.text?.substring(0, 50)}..."`);
          (window as any).__speechSynthCalled = true;
          return origSpeak(utt);
        };
      }

      (window as any).__audioPlayCalled = false;
      (window as any).__speechSynthCalled = false;
    });

    await page.goto('http://localhost:4399/battle', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Enter demo mode
    if (await page.locator('#no-webgpu').isVisible()) {
      await page.click('#fallback-mode-btn');
      await page.waitForTimeout(500);
    }

    // Init audio + select mode
    await page.click('#battle-arena');
    await page.waitForTimeout(300);
    await page.click('[data-mode="freestyle"]');
    await page.waitForTimeout(3000);

    // Reset tracking for the response phase
    await page.evaluate(() => {
      (window as any).__audioPlayCalled = false;
      (window as any).__speechSynthCalled = false;
    });

    // Type a message and send
    await page.fill('#player-input', 'To be or not to be, that is the question, whether tis nobler to spit bars or take the L');
    await page.click('#send-btn');

    // Wait for demo response (1.5s delay + speak)
    await page.waitForTimeout(4000);

    const result = await page.evaluate(() => ({
      audioPlayCalled: (window as any).__audioPlayCalled,
      speechSynthCalled: (window as any).__speechSynthCalled,
    }));

    const ttsLogs = logs.filter(l => l.includes('TTS-DIAG'));
    console.log('\n=== TTS DIAGNOSTIC (response) ===');
    ttsLogs.forEach(l => console.log(l));
    console.log(`Audio.play() called: ${result.audioPlayCalled}`);
    console.log(`speechSynthesis.speak() called: ${result.speechSynthCalled}`);

    expect(result.audioPlayCalled || result.speechSynthCalled).toBe(true);
  });
});
