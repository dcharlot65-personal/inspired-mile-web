import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-ignore a plain ES module of the build scripts
import { measureHostProblem, ortBinaryFor } from '../../../scripts/voice/host.mjs';

describe('scripts/voice/measure.mjs says plainly where it cannot run', () => {
  it('finds a binary only for the platforms the package ships', () => {
    const root = mkdtempSync(join(tmpdir(), 'ort-host-'));
    const dir = join(root, 'node_modules/onnxruntime-node');
    mkdirSync(join(dir, 'bin/napi-v6/darwin/arm64'), { recursive: true });
    mkdirSync(join(dir, 'bin/napi-v6/linux/x64'), { recursive: true });
    writeFileSync(join(dir, 'package.json'), '{"version":"1.31.0"}');
    expect(measureHostProblem(root, 'darwin', 'arm64')).toBeNull();
    expect(measureHostProblem(root, 'linux', 'x64')).toBeNull();
    expect(measureHostProblem(root, 'darwin', 'x64')).toMatch(/onnxruntime-node 1\.31\.0.*darwin\/x64/);
    expect(measureHostProblem(join(root, 'nowhere'), 'darwin', 'arm64')).toMatch(/npm ci/);
  });

  it('the installed onnxruntime-node (Whisper\'s) runs on arm64 Macs and Linux, and not on Intel Macs', () => {
    // If the last line fails, a newer onnxruntime-node ships an Intel Mac binary: CLAUDE.md's note is stale.
    const dir = 'node_modules/onnxruntime-node';
    expect(ortBinaryFor(dir, 'darwin', 'arm64')).toBe(true);
    expect(ortBinaryFor(dir, 'linux', 'x64')).toBe(true);
    expect(ortBinaryFor(dir, 'darwin', 'x64')).toBe(false);
  });
});
