/**
 * Batch-generate all 216 hero variant portrait images using Z-Image Turbo (Gradio API).
 *
 * Run:  npx tsx scripts/generate-variant-art.ts
 *
 * - Reads variant catalog from src/data/variant-catalog.json
 * - Builds refined cinematic portrait prompts (no card-frame artifacts)
 * - Calls Z-Image Turbo at https://mcp-tools-z-image-turbo.hf.space/
 * - Saves 864x1152 WebP images to public/images/variants/
 * - Skips already-generated images (> 0 bytes)
 * - 2s rate limit between calls, exponential backoff on errors
 */

import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const CATALOG_PATH = resolve(__dirname, '../src/data/variant-catalog.json');
const OUTPUT_DIR = resolve(__dirname, '../public/images/variants');

// ---------------------------------------------------------------------------
// Gradio API config
// ---------------------------------------------------------------------------

const GRADIO_BASE = 'https://mcp-tools-z-image-turbo.hf.space';
const GRADIO_ENDPOINT = '/gradio_api/call/generate';
const STEPS = 8;
const SHIFT = 3;
const RANDOM_SEED = true;
const SEED = 42;
const RESOLUTION = '864x1152 ( 3:4 )';

// HuggingFace authentication — set HF_TOKEN env var for authenticated access
const HF_TOKEN = process.env.HF_TOKEN || '';

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

const BASE_DELAY_MS = 2000;
const MAX_RETRIES = 5;
const BACKOFF_MULTIPLIER = 2;

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Character description map  (baseCardId -> portrait description)
// ---------------------------------------------------------------------------

const CHARACTER_DESCRIPTIONS: Record<string, string> = {
  'SM-001': 'a charismatic hip-hop poet',
  'MO-001': 'a passionate young romantic in modern hip-hop style',
  'CA-001': 'a beautiful defiant young woman in modern hip-hop style',
  'DC-001': 'a brooding intellectual prince in modern hip-hop style',
  'DC-002': 'a graceful ethereal young woman in modern hip-hop style',
  'MO-002': 'a wild charismatic showman in modern hip-hop style',
  'FA-001': 'a mischievous trickster sprite in modern hip-hop style',
  'FA-002': 'a majestic fairy queen in modern hip-hop style',
  'VC-001': 'a commanding authoritative ruler in modern hip-hop style',
  'VC-002': 'a wise elderly friar in modern hip-hop style',
  'VC-003': 'a warm loyal caretaker woman in modern hip-hop style',
  'TP-001': 'a powerful sorcerer in modern hip-hop style',
  'TP-002': 'an ethereal wind spirit in modern hip-hop style',
  'TP-003': 'a fierce wild beast-man in modern hip-hop style',
  'MO-003': 'a peaceful mediator young man in modern hip-hop style',
  'CA-002': 'a dangerous fiery swordsman in modern hip-hop style',
  'DC-003': 'a cunning scheming king in modern hip-hop style',
  'FA-003': 'a shadowy powerful fairy king in modern hip-hop style',
};

// ---------------------------------------------------------------------------
// City scene prefix map  (city name -> scenePrefix from catalog)
// ---------------------------------------------------------------------------

interface CityInfo {
  scenePrefix: string;
}

interface HeroVariant {
  variantId: string;
  baseCardId: string;
  city: string;
  attire: string;
  hairstyle: string;
  skinTone: string;
}

interface VariantCatalog {
  heroVariants: HeroVariant[];
  cities: Record<string, CityInfo>;
}

// ---------------------------------------------------------------------------
// City scene prefixes (from variants.ts — catalog JSON omits scenePrefix)
// ---------------------------------------------------------------------------

const CITY_SCENE_PREFIXES: Record<string, string> = {
  'Tokyo': 'Neon-lit Shibuya crossing at night, towering LED screens, rain-slicked streets.',
  'Lagos': 'Vibrant Lagos market street at golden hour, colorful murals, bustling energy.',
  'Brooklyn': 'Brooklyn rooftop at sunset, Manhattan skyline behind, graffiti-covered water towers.',
  'London': 'Moody London alley near the Globe Theatre, fog and neon, brick and steel.',
  'Mumbai': 'Neon-lit Mumbai street at night, auto-rickshaws, Dharavi art meets Bollywood glamour.',
  'Paris': 'Parisian rooftop overlooking the Eiffel Tower at dusk, street art and high fashion.',
  'Sao Paulo': 'Sao Paulo street corner, vivid graffiti murals, tropical trees meeting concrete.',
  'Seoul': 'Neon Seoul district at night, K-pop billboards, cherry blossoms meet cyberpunk.',
  'Nairobi': 'Nairobi skyline at golden hour, acacia trees, modern glass towers meet red earth.',
  'Berlin': 'Berlin warehouse district, industrial art, concrete and neon, the Wall in the background.',
  'Mexico City': 'Mexico City zocalo at twilight, Day of the Dead murals, colonial meets modern.',
  'Cairo': 'Cairo at dusk, pyramids in the distance, bustling modern streets, golden sand tones.',
};

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildPrompt(variant: HeroVariant): string {
  const scenePrefix = CITY_SCENE_PREFIXES[variant.city] || `${variant.city} cityscape, dramatic urban backdrop.`;
  const charDesc = CHARACTER_DESCRIPTIONS[variant.baseCardId] || 'a Shakespearean character in modern hip-hop style';
  const attireLabel = variant.attire.replace(/-/g, ' ');
  const hairstyleLabel = variant.hairstyle.replace(/-/g, ' ');
  const skinToneLabel = variant.skinTone.replace(/-/g, ' ');

  return `${scenePrefix} ${charDesc}, standing confidently, wearing ${attireLabel} clothing, ${hairstyleLabel} hairstyle, ${skinToneLabel} skin tone. Cinematic portrait photography, dramatic lighting, shallow depth of field, 3/4 view.`;
}

// ---------------------------------------------------------------------------
// Gradio API caller
// ---------------------------------------------------------------------------

async function callGradioGenerate(prompt: string): Promise<Buffer> {
  // Step 1: POST to initiate generation
  const postUrl = `${GRADIO_BASE}${GRADIO_ENDPOINT}`;
  const postBody = {
    data: [prompt, RESOLUTION, SEED, STEPS, SHIFT, RANDOM_SEED],
  };

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (HF_TOKEN) headers['Authorization'] = `Bearer ${HF_TOKEN}`;

  const postResp = await fetch(postUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(postBody),
  });

  if (!postResp.ok) {
    const text = await postResp.text();
    throw new Error(`Gradio POST failed (${postResp.status}): ${text}`);
  }

  const postJson = (await postResp.json()) as { event_id: string };
  const eventId = postJson.event_id;

  if (!eventId) {
    throw new Error(`No event_id in Gradio response: ${JSON.stringify(postJson)}`);
  }

  // Step 2: GET the event stream to receive the result
  const getUrl = `${GRADIO_BASE}${GRADIO_ENDPOINT}/${eventId}`;
  const getResp = await fetch(getUrl);

  if (!getResp.ok) {
    const text = await getResp.text();
    throw new Error(`Gradio GET failed (${getResp.status}): ${text}`);
  }

  const streamText = await getResp.text();

  // Parse the SSE-style response to find the image URL
  // The stream contains lines like:
  //   event: complete
  //   data: [{"url": "...", "path": "...", ...}]
  const imageUrl = extractImageUrl(streamText);

  if (!imageUrl) {
    throw new Error(`Could not extract image URL from Gradio response:\n${streamText.slice(0, 500)}`);
  }

  // Step 3: Download the image
  const resolvedUrl = imageUrl.startsWith('http') ? imageUrl : `${GRADIO_BASE}${imageUrl}`;
  const imageResp = await fetch(resolvedUrl);

  if (!imageResp.ok) {
    throw new Error(`Image download failed (${imageResp.status}): ${resolvedUrl}`);
  }

  const arrayBuf = await imageResp.arrayBuffer();
  return Buffer.from(arrayBuf);
}

function extractImageUrl(streamText: string): string | null {
  // Look for JSON data lines in the SSE stream
  const lines = streamText.split('\n');
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const dataStr = line.slice(6).trim();
    if (!dataStr) continue;

    try {
      const parsed = JSON.parse(dataStr);

      // Response could be an array: [{url: "...", ...}]
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === 'object' && item.url) {
            return item.url as string;
          }
          // Could also be a nested structure: [[{url: "..."}]]
          if (Array.isArray(item)) {
            for (const inner of item) {
              if (inner && typeof inner === 'object' && inner.url) {
                return inner.url as string;
              }
            }
          }
        }
      }

      // Response could be an object with a url field
      if (parsed && typeof parsed === 'object' && parsed.url) {
        return parsed.url as string;
      }
    } catch {
      // Not valid JSON, skip this line
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // Read catalog
  if (!existsSync(CATALOG_PATH)) {
    console.error(`Catalog not found: ${CATALOG_PATH}`);
    console.error('Run: npx tsx scripts/generate-variant-catalog.ts');
    process.exit(1);
  }

  const catalog: VariantCatalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf-8'));
  const variants = catalog.heroVariants;

  console.log(`Loaded ${variants.length} hero variants from catalog`);
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log('');

  // Ensure output directory exists
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // Track results
  let generated = 0;
  let skipped = 0;
  let failed = 0;
  const failures: { variantId: string; error: string }[] = [];

  for (let i = 0; i < variants.length; i++) {
    const variant = variants[i];
    const outPath = resolve(OUTPUT_DIR, `${variant.variantId}.webp`);
    const progress = `[${i + 1}/${variants.length}]`;

    // Skip if already exists and has content
    if (existsSync(outPath)) {
      try {
        const stat = statSync(outPath);
        if (stat.size > 0) {
          console.log(`${progress} Skipping ${variant.variantId} (exists, ${(stat.size / 1024).toFixed(0)} KB)`);
          skipped++;
          continue;
        }
      } catch {
        // File stat failed, regenerate
      }
    }

    const prompt = buildPrompt(variant);
    console.log(`${progress} Generating ${variant.variantId}...`);

    let success = false;
    let lastError = '';

    for (let retry = 0; retry < MAX_RETRIES; retry++) {
      try {
        const imageBuffer = await callGradioGenerate(prompt);

        if (imageBuffer.length === 0) {
          throw new Error('Received empty image buffer');
        }

        writeFileSync(outPath, imageBuffer);
        console.log(`  -> Saved (${(imageBuffer.length / 1024).toFixed(0)} KB)`);
        generated++;
        success = true;
        break;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        const backoffMs = BASE_DELAY_MS * Math.pow(BACKOFF_MULTIPLIER, retry);
        console.error(`  -> Error (attempt ${retry + 1}/${MAX_RETRIES}): ${lastError}`);

        if (retry < MAX_RETRIES - 1) {
          console.log(`  -> Retrying in ${(backoffMs / 1000).toFixed(1)}s...`);
          await sleep(backoffMs);
        }
      }
    }

    if (!success) {
      console.error(`  -> FAILED after ${MAX_RETRIES} attempts: ${variant.variantId}`);
      failed++;
      failures.push({ variantId: variant.variantId, error: lastError });
    }

    // Rate limit between calls (not after the last one)
    if (i < variants.length - 1) {
      await sleep(BASE_DELAY_MS);
    }
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------

  console.log('');
  console.log('='.repeat(60));
  console.log('GENERATION COMPLETE');
  console.log('='.repeat(60));
  console.log(`  Generated: ${generated}`);
  console.log(`  Skipped:   ${skipped}`);
  console.log(`  Failed:    ${failed}`);
  console.log(`  Total:     ${variants.length}`);
  console.log('');

  if (failures.length > 0) {
    console.log('Failed variants:');
    for (const f of failures) {
      console.log(`  - ${f.variantId}: ${f.error}`);
    }
    console.log('');
  }

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
