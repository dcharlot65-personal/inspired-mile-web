/**
 * Generate the remaining 18 hero variant images that couldn't be completed
 * due to HuggingFace ZeroGPU quota limits.
 *
 * Run:  npx tsx scripts/generate-remaining-variants.ts
 *
 * Uses the same Gradio API as generate-variant-art.ts but only targets
 * the specific missing images. Skips any that already exist on disk.
 *
 * Requires HF_TOKEN env var for authenticated ZeroGPU access.
 */

import { writeFileSync, existsSync, statSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUTPUT_DIR = resolve(__dirname, '../public/images/variants');
const GRADIO_BASE = 'https://mcp-tools-z-image-turbo.hf.space';
const GRADIO_ENDPOINT = '/gradio_api/call/generate';
const HF_TOKEN = process.env.HF_TOKEN || '';

const BASE_DELAY_MS = 3000;
const MAX_RETRIES = 5;

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

interface RemainingVariant {
  variantId: string;
  prompt: string;
}

const REMAINING: RemainingVariant[] = [
  // DC-003 (cunning scheming king) — 6 remaining cities
  {
    variantId: 'DC-003-SPO-00-00-02',
    prompt: 'Sao Paulo street corner, vivid graffiti murals, tropical trees meeting concrete. a cunning scheming king in modern hip-hop style, standing confidently, wearing streetwear clothing, buzz cut hairstyle, medium skin tone. Cinematic portrait photography, dramatic lighting, shallow depth of field, 3/4 view.',
  },
  {
    variantId: 'DC-003-SEO-00-00-02',
    prompt: 'Neon Seoul district at night, K-pop billboards, cherry blossoms meet cyberpunk. a cunning scheming king in modern hip-hop style, standing confidently, wearing streetwear clothing, two block cut hairstyle, medium skin tone. Cinematic portrait photography, dramatic lighting, shallow depth of field, 3/4 view.',
  },
  {
    variantId: 'DC-003-NBO-00-00-02',
    prompt: 'Nairobi skyline at golden hour, acacia trees, modern glass towers meet red earth. a cunning scheming king in modern hip-hop style, standing confidently, wearing streetwear clothing, short locs hairstyle, medium skin tone. Cinematic portrait photography, dramatic lighting, shallow depth of field, 3/4 view.',
  },
  {
    variantId: 'DC-003-BER-00-00-02',
    prompt: 'Berlin warehouse district, industrial art, concrete and neon, the Wall in the background. a cunning scheming king in modern hip-hop style, standing confidently, wearing streetwear clothing, undercut hairstyle, medium skin tone. Cinematic portrait photography, dramatic lighting, shallow depth of field, 3/4 view.',
  },
  {
    variantId: 'DC-003-MXC-00-00-02',
    prompt: 'Mexico City zocalo at twilight, Day of the Dead murals, colonial meets modern. a cunning scheming king in modern hip-hop style, standing confidently, wearing streetwear clothing, slicked back hairstyle, medium skin tone. Cinematic portrait photography, dramatic lighting, shallow depth of field, 3/4 view.',
  },
  {
    variantId: 'DC-003-CAI-00-00-02',
    prompt: 'Cairo at dusk, pyramids in the distance, bustling modern streets, golden sand tones. a cunning scheming king in modern hip-hop style, standing confidently, wearing streetwear clothing, tapered fade hairstyle, medium skin tone. Cinematic portrait photography, dramatic lighting, shallow depth of field, 3/4 view.',
  },
  // FA-003 (shadowy powerful fairy king) — all 12 cities
  {
    variantId: 'FA-003-TKY-00-00-02',
    prompt: 'Neon-lit Shibuya crossing at night, towering LED screens, rain-slicked streets. a shadowy powerful fairy king in modern hip-hop style, standing confidently, wearing streetwear clothing, top knot hairstyle, medium skin tone. Cinematic portrait photography, dramatic lighting, shallow depth of field, 3/4 view.',
  },
  {
    variantId: 'FA-003-LGS-00-00-02',
    prompt: 'Vibrant Lagos market street at golden hour, colorful murals, bustling energy. a shadowy powerful fairy king in modern hip-hop style, standing confidently, wearing agbada streetwear clothing, cornrows hairstyle, medium skin tone. Cinematic portrait photography, dramatic lighting, shallow depth of field, 3/4 view.',
  },
  {
    variantId: 'FA-003-BKN-00-00-02',
    prompt: 'Brooklyn rooftop at sunset, Manhattan skyline behind, graffiti-covered water towers. a shadowy powerful fairy king in modern hip-hop style, standing confidently, wearing streetwear clothing, high top fade hairstyle, medium skin tone. Cinematic portrait photography, dramatic lighting, shallow depth of field, 3/4 view.',
  },
  {
    variantId: 'FA-003-LDN-00-00-02',
    prompt: 'Moody London alley near the Globe Theatre, fog and neon, brick and steel. a shadowy powerful fairy king in modern hip-hop style, standing confidently, wearing tweed streetwear clothing, textured crop hairstyle, medium skin tone. Cinematic portrait photography, dramatic lighting, shallow depth of field, 3/4 view.',
  },
  {
    variantId: 'FA-003-MBI-00-00-02',
    prompt: 'Neon-lit Mumbai street at night, auto-rickshaws, Dharavi art meets Bollywood glamour. a shadowy powerful fairy king in modern hip-hop style, standing confidently, wearing kurta streetwear clothing, slicked back hairstyle, medium skin tone. Cinematic portrait photography, dramatic lighting, shallow depth of field, 3/4 view.',
  },
  {
    variantId: 'FA-003-PRS-00-00-02',
    prompt: 'Parisian rooftop overlooking the Eiffel Tower at dusk, street art and high fashion. a shadowy powerful fairy king in modern hip-hop style, standing confidently, wearing haute streetwear clothing, French crop hairstyle, medium skin tone. Cinematic portrait photography, dramatic lighting, shallow depth of field, 3/4 view.',
  },
  {
    variantId: 'FA-003-SPO-00-00-02',
    prompt: 'Sao Paulo street corner, vivid graffiti murals, tropical trees meeting concrete. a shadowy powerful fairy king in modern hip-hop style, standing confidently, wearing streetwear clothing, buzz cut hairstyle, medium skin tone. Cinematic portrait photography, dramatic lighting, shallow depth of field, 3/4 view.',
  },
  {
    variantId: 'FA-003-SEO-00-00-02',
    prompt: 'Neon Seoul district at night, K-pop billboards, cherry blossoms meet cyberpunk. a shadowy powerful fairy king in modern hip-hop style, standing confidently, wearing streetwear clothing, two block cut hairstyle, medium skin tone. Cinematic portrait photography, dramatic lighting, shallow depth of field, 3/4 view.',
  },
  {
    variantId: 'FA-003-NBO-00-00-02',
    prompt: 'Nairobi skyline at golden hour, acacia trees, modern glass towers meet red earth. a shadowy powerful fairy king in modern hip-hop style, standing confidently, wearing streetwear clothing, short locs hairstyle, medium skin tone. Cinematic portrait photography, dramatic lighting, shallow depth of field, 3/4 view.',
  },
  {
    variantId: 'FA-003-BER-00-00-02',
    prompt: 'Berlin warehouse district, industrial art, concrete and neon, the Wall in the background. a shadowy powerful fairy king in modern hip-hop style, standing confidently, wearing streetwear clothing, undercut hairstyle, medium skin tone. Cinematic portrait photography, dramatic lighting, shallow depth of field, 3/4 view.',
  },
  {
    variantId: 'FA-003-MXC-00-00-02',
    prompt: 'Mexico City zocalo at twilight, Day of the Dead murals, colonial meets modern. a shadowy powerful fairy king in modern hip-hop style, standing confidently, wearing streetwear clothing, slicked back hairstyle, medium skin tone. Cinematic portrait photography, dramatic lighting, shallow depth of field, 3/4 view.',
  },
  {
    variantId: 'FA-003-CAI-00-00-02',
    prompt: 'Cairo at dusk, pyramids in the distance, bustling modern streets, golden sand tones. a shadowy powerful fairy king in modern hip-hop style, standing confidently, wearing streetwear clothing, tapered fade hairstyle, medium skin tone. Cinematic portrait photography, dramatic lighting, shallow depth of field, 3/4 view.',
  },
];

// ---------------------------------------------------------------------------
// Gradio API
// ---------------------------------------------------------------------------

async function callGradioGenerate(prompt: string): Promise<Buffer> {
  const postUrl = `${GRADIO_BASE}${GRADIO_ENDPOINT}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (HF_TOKEN) headers['Authorization'] = `Bearer ${HF_TOKEN}`;

  const postResp = await fetch(postUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      data: [prompt, '864x1152 ( 3:4 )', 42, 8, 3, true],
    }),
  });

  if (!postResp.ok) {
    const text = await postResp.text();
    throw new Error(`POST failed (${postResp.status}): ${text}`);
  }

  const { event_id } = (await postResp.json()) as { event_id: string };
  if (!event_id) throw new Error('No event_id returned');

  const getResp = await fetch(`${GRADIO_BASE}${GRADIO_ENDPOINT}/${event_id}`);
  if (!getResp.ok) throw new Error(`GET failed (${getResp.status})`);

  const streamText = await getResp.text();
  const imageUrl = extractImageUrl(streamText);
  if (!imageUrl) throw new Error(`No image URL in response: ${streamText.slice(0, 300)}`);

  const resolvedUrl = imageUrl.startsWith('http') ? imageUrl : `${GRADIO_BASE}${imageUrl}`;
  const imageResp = await fetch(resolvedUrl);
  if (!imageResp.ok) throw new Error(`Image download failed (${imageResp.status})`);

  return Buffer.from(await imageResp.arrayBuffer());
}

function extractImageUrl(streamText: string): string | null {
  for (const line of streamText.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    try {
      const parsed = JSON.parse(line.slice(6).trim());
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item?.url) return item.url;
          if (Array.isArray(item)) {
            for (const inner of item) {
              if (inner?.url) return inner.url;
            }
          }
        }
      }
      if (parsed?.url) return parsed.url;
    } catch { /* skip */ }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const toGenerate = REMAINING.filter(v => {
    const path = resolve(OUTPUT_DIR, `${v.variantId}.webp`);
    if (existsSync(path)) {
      try {
        if (statSync(path).size > 0) {
          console.log(`Skipping ${v.variantId} (exists)`);
          return false;
        }
      } catch { /* regenerate */ }
    }
    return true;
  });

  console.log(`${toGenerate.length} images to generate (${REMAINING.length - toGenerate.length} already exist)\n`);

  let generated = 0;
  let failed = 0;

  for (let i = 0; i < toGenerate.length; i++) {
    const v = toGenerate[i];
    const outPath = resolve(OUTPUT_DIR, `${v.variantId}.webp`);
    console.log(`[${i + 1}/${toGenerate.length}] Generating ${v.variantId}...`);

    let success = false;
    for (let retry = 0; retry < MAX_RETRIES; retry++) {
      try {
        const buf = await callGradioGenerate(v.prompt);
        if (buf.length === 0) throw new Error('Empty buffer');
        writeFileSync(outPath, buf);
        console.log(`  -> Saved (${(buf.length / 1024).toFixed(0)} KB)`);
        generated++;
        success = true;
        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  -> Error (attempt ${retry + 1}/${MAX_RETRIES}): ${msg}`);
        if (retry < MAX_RETRIES - 1) {
          const backoff = BASE_DELAY_MS * Math.pow(2, retry);
          console.log(`  -> Retrying in ${(backoff / 1000).toFixed(1)}s...`);
          await sleep(backoff);
        }
      }
    }

    if (!success) {
      console.error(`  -> FAILED: ${v.variantId}`);
      failed++;
    }

    if (i < toGenerate.length - 1) await sleep(BASE_DELAY_MS);
  }

  console.log(`\nDone: ${generated} generated, ${failed} failed, ${REMAINING.length - toGenerate.length} skipped`);
  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
