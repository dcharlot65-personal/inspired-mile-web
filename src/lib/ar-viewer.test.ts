import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AR_MODELS, hasARModel } from './ar-viewer';
import { getCardById } from './cards';

const rootUrl = (rel: string) => new URL(`../../${rel}`, import.meta.url);

describe('AR_MODELS 3D collector trophies', () => {
  const provenance = JSON.parse(readFileSync(rootUrl('public/models/provenance.json'), 'utf8')) as {
    generator: string;
    models: Array<{
      card_id: string;
      file: string;
      bytes: number;
      sha256: string;
      watertight: boolean;
      non_manifold_edges: number;
      boundary_edges: number;
      triangles: number;
    }>;
  };

  it('covers all 18 configured character cards with real catalog entries', () => {
    const ids = Object.keys(AR_MODELS);
    expect(ids).toHaveLength(18);
    expect(provenance.generator).toMatch(/^Blender 5\.3\.0/);
    expect(provenance.models).toHaveLength(18);

    for (const id of ids) {
      expect(hasARModel(id)).toBe(true);
      const card = getCardById(id);
      expect(card, `${id} exists in CARD_CATALOG`).toBeDefined();
      expect(card?.type).toBe('Character');
    }
  });

  it('ships a watertight, normal-mapped glTF 2.0 triangle mesh (< 350 KiB) for every AR_MODELS entry, never a point cloud', () => {
    for (const [id, cfg] of Object.entries(AR_MODELS)) {
      const rel = `public${cfg.glbPath}`;
      expect(existsSync(rootUrl(rel)), `${rel} exists`).toBe(true);
      const bytes = readFileSync(rootUrl(rel));

      // Budget: < 350 KiB (358,400 bytes)
      expect(bytes.byteLength, `${rel} < 350 KiB`).toBeLessThan(350 * 1024);
      expect(bytes.subarray(0, 4).toString('ascii')).toBe('glTF');
      expect(bytes.readUInt32LE(4)).toBe(2);

      const jsonLen = bytes.readUInt32LE(12);
      const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLen).toString('utf8'));

      // Every primitive must be mode 4 (TRIANGLES, default in glTF 2.0), never mode 0 (POINTS)
      const primitives = (gltf.meshes ?? []).flatMap((m: any) => m.primitives ?? []);
      expect(primitives.length, `${id} has mesh primitives`).toBeGreaterThanOrEqual(5);
      for (const p of primitives) {
        expect(p.mode ?? 4, `${id} uses TRIANGLES, not point cloud`).toBe(4);
        expect(p.attributes?.NORMAL, `${id} exports vertex normals`).toBeDefined();
        expect(p.attributes?.TANGENT, `${id} exports vertex tangents`).toBeDefined();
      }
      expect((gltf.materials ?? []).some((m: any) => m.normalTexture !== undefined), `${id} embeds normalTexture`).toBe(true);

      // Provenance SHA-256 and watertight manifold record match byte-for-byte
      const rec = provenance.models.find((m) => m.card_id === id);
      expect(rec, `${id} in provenance.json`).toBeDefined();
      expect(rec?.watertight).toBe(true);
      expect(rec?.non_manifold_edges).toBe(0);
      expect(rec?.boundary_edges).toBe(0);
      expect(rec?.triangles).toBeGreaterThan(2500);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(rec?.sha256);
    }
  });
});
