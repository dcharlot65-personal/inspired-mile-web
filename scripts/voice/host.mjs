/**
 * Can this host run scripts/voice/measure.mjs? Whisper runs on the onnxruntime-node that the
 * site's Transformers.js 4 installs, and that package ships a native binary for some platforms
 * only: 1.31 has none for Intel macOS (the iMac Pro build host), where it fails after the
 * downloads with an error about a missing binding. measure.mjs asks first and says so plainly.
 * (scripts/voice/say.mjs needs only kokoro-js's own, older onnxruntime-node, which has one.)
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Whether the onnxruntime-node in `dir` has a binary for `platform`/`arch` (true when its layout is not the known one). */
export function ortBinaryFor(dir, platform = process.platform, arch = process.arch) {
  const bin = join(dir, 'bin');
  if (!existsSync(bin)) return true;
  return readdirSync(bin).some((napi) => existsSync(join(bin, napi, platform, arch)));
}

/** null when this host can run the measurement, else why not. */
export function measureHostProblem(root, platform = process.platform, arch = process.arch) {
  const dir = join(root, 'node_modules/onnxruntime-node');
  if (!existsSync(join(dir, 'package.json'))) return 'node_modules/onnxruntime-node is not installed: run npm ci first.';
  if (ortBinaryFor(dir, platform, arch)) return null;
  const version = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version;
  return `onnxruntime-node ${version}, which runs Whisper here, ships no binary for ${platform}/${arch}. Run the measurement on an arm64 Mac (the Studio, or the M4) or on Linux.`;
}
