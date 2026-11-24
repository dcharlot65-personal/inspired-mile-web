#!/usr/bin/env python3
"""
First-Party Blender 5.3.0 Procedural 3D Collector Trophy & AR Sculpture Generator
for Inspired Mile — Sonnet Man (`public/models/*.glb` + `public/models/splats/sm-001.ply`).

Compliance & Provenance (docs/dossier/28-owner-decisions.md):
- D-13 / D-14 / R8 (Devon Glover): SM-001 ("The Sonnet Man") depicts ZERO human figure or
  likeness. It is "The Ring Stage Emblem": an obsidian-and-brass collector plinth topped with
  a golden spotlight stage ring, a classic vintage ribbed brass hip-hop stage microphone on an
  angled stand, and an open First Folio / Quarto book on a lectern ringed by sculpted flames.
- D-30 & Part 1.3 (Free, self-hosted, >= 2026-04-01): 100% first-party procedural geometry
  and procedural tangent-space normal maps built in Blender 5.3.0 (build date 2026-11-10)
  on fw2 (`~/opt/blender-5.3.0/blender --background --python scripts/art/forge_ar_trophies_blender.py`).
  No external AI model, cloud API, or third-party mesh/texture is used.

Guarantees verified per model before export:
1. Proper glTF 2.0 triangle mesh (mode 4 TRIANGLES, never mode 0 point clouds).
2. Watertight 2-manifold geometry (0 non-manifold edges, 0 boundary edges verified via bmesh).
3. Multi-slot Principled BSDF PBR materials + embedded procedural tangent-space normal map PNG.
4. File size < 350 KB per .glb collectible.
"""

from __future__ import annotations

import hashlib
import json
import math
import os
import random
import struct
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Euler, Matrix, Quaternion, Vector

REPO_ROOT = Path(__file__).resolve().parents[2]
MODELS_DIR = REPO_ROOT / "public" / "models"
SPLATS_DIR = MODELS_DIR / "splats"
NORMAL_MAP_PATH = Path("/tmp/im_collector_micro_normal.png")


# ---------------------------------------------------------------------------
# 18 Bespoke Collector Sculptures matching src/lib/ar-viewer.ts & src/lib/cards.ts
# ---------------------------------------------------------------------------
CARD_SPECS = [
    {
        "id": "SM-001",
        "name": "The Sonnet Man",
        "house": "Legendary",
        "motif": "The Ring Stage Emblem: Golden Spotlight Stage Ring, Vintage Brass Hip-Hop Microphone & Open Quarto Folio (Zero Human Likeness)",
        "primary": (0.92, 0.69, 0.16),   # stage gold
        "secondary": (0.76, 0.14, 0.18), # stage crimson
        "accent": (1.00, 0.84, 0.36),    # spotlight amber
        "emissive": (0.35, 0.22, 0.03),
    },
    {
        "id": "MO-001",
        "name": "Romeo",
        "house": "Montague",
        "motif": "Verona Moonlit Balcony Balustrade, Climbing Crimson Rose & Inscribed Golden Vow Ring",
        "primary": (0.78, 0.12, 0.22),   # crimson passion
        "secondary": (0.84, 0.78, 0.72), # Verona limestone
        "accent": (0.93, 0.74, 0.24),    # vow ring gold
        "emissive": (0.18, 0.02, 0.05),
    },
    {
        "id": "CA-001",
        "name": "Juliet",
        "house": "Capulet",
        "motif": "Capulet Crescent-Moon Trellis, Blooming Garden Rose & Perched Silver Nightingale",
        "primary": (0.20, 0.40, 0.84),   # sapphire grace
        "secondary": (0.86, 0.30, 0.46), # Juliet rose
        "accent": (0.86, 0.89, 0.96),    # moonlit silver
        "emissive": (0.04, 0.09, 0.24),
    },
    {
        "id": "DC-001",
        "name": "Hamlet",
        "house": "Danish Court",
        "motif": "Elsinore Battlement Crowned Yorick Skull & Crossed Swept-Hilt Rapier",
        "primary": (0.44, 0.22, 0.74),   # Elsinore royal violet
        "secondary": (0.89, 0.85, 0.76), # aged bone ivory
        "accent": (0.85, 0.68, 0.22),    # Danish crown brass
        "emissive": (0.10, 0.04, 0.20),
    },
    {
        "id": "DC-002",
        "name": "Ophelia",
        "house": "Danish Court",
        "motif": "Willow-Stream Ripple Basin, Floating Rosemary Wreath & Remembrance Chalice",
        "primary": (0.12, 0.66, 0.68),   # stream cyan-teal
        "secondary": (0.32, 0.62, 0.42), # willow & rosemary green
        "accent": (0.88, 0.92, 0.94),    # blossom pearl
        "emissive": (0.03, 0.18, 0.20),
    },
    {
        "id": "MO-002",
        "name": "Mercutio",
        "house": "Montague",
        "motif": "Queen Mab Venetian Masquerade Crest, Twin Crossed Duelling Rapiers & Steel Sparks",
        "primary": (0.92, 0.46, 0.12),   # fiery amber-orange
        "secondary": (0.78, 0.81, 0.86), # Verona forged steel
        "accent": (0.96, 0.76, 0.24),    # carnival gilt
        "emissive": (0.24, 0.10, 0.02),
    },
    {
        "id": "FA-001",
        "name": "Puck",
        "house": "Forest of Arden",
        "motif": "Enchanted Oak Horned Trickster Crest, Love-in-Idleness Blossom & Pixie Orbitals",
        "primary": (0.14, 0.72, 0.42),   # forest emerald
        "secondary": (0.44, 0.28, 0.16), # ancient oak bark
        "accent": (0.74, 0.34, 0.92),    # purple flower nectar
        "emissive": (0.04, 0.22, 0.10),
    },
    {
        "id": "FA-002",
        "name": "Titania",
        "house": "Forest of Arden",
        "motif": "Living-Vine Arched Fairy Throne, Blossom Diadem & Golden Firefly Canopy",
        "primary": (0.42, 0.80, 0.24),   # luminous lime-emerald
        "secondary": (0.90, 0.68, 0.26), # fairy crown gold
        "accent": (0.94, 0.48, 0.68),    # wild orchid rose
        "emissive": (0.12, 0.26, 0.04),
    },
    {
        "id": "VC-001",
        "name": "Prince Escalus",
        "house": "Verona Court",
        "motif": "Verona Palace Imperial Scepter & Balanced Scales of Civic Peace",
        "primary": (0.90, 0.66, 0.14),   # imperial amber gold
        "secondary": (0.86, 0.84, 0.80), # palace marble
        "accent": (0.72, 0.20, 0.18),    # Verona decree crimson
        "emissive": (0.20, 0.14, 0.02),
    },
    {
        "id": "VC-002",
        "name": "Friar Lawrence",
        "house": "Verona Court",
        "motif": "Monastery Cloister Mortar & Pestle, Stoppered Herb Elixir Flask & Beeswax Taper",
        "primary": (0.58, 0.53, 0.46),   # cloister stone
        "secondary": (0.86, 0.58, 0.16), # amber apothecary glass
        "accent": (0.28, 0.60, 0.32),    # medicinal herb wreath
        "emissive": (0.20, 0.12, 0.02),
    },
    {
        "id": "VC-003",
        "name": "The Nurse",
        "house": "Verona Court",
        "motif": "Wax-Sealed Secret Scroll, Coiled Rope-Ladder Cordage & Brass Household Key",
        "primary": (0.84, 0.36, 0.46),   # warm rose devotion
        "secondary": (0.88, 0.82, 0.70), # vellum parchment
        "accent": (0.82, 0.64, 0.24),    # chatelaine key brass
        "emissive": (0.14, 0.04, 0.06),
    },
    {
        "id": "TP-001",
        "name": "Prospero",
        "house": "The Tempest",
        "motif": "Tempest Gnarled Arcane Staff, Storm Armillary Rings & Open Sea-Codex",
        "primary": (0.22, 0.38, 0.88),   # tempest indigo-blue
        "secondary": (0.42, 0.27, 0.16), # sea-weathered staff wood
        "accent": (0.56, 0.84, 1.00),    # arcane lightning cyan
        "emissive": (0.08, 0.18, 0.38),
    },
    {
        "id": "TP-002",
        "name": "Ariel",
        "house": "The Tempest",
        "motif": "Spirit-of-Air Ascending Wind Vortex, Sculpted Zephyr Wings & Celestial Lyre",
        "primary": (0.26, 0.78, 0.94),   # sky spirit cyan
        "secondary": (0.90, 0.94, 0.98), # iridescent cloud silver
        "accent": (0.88, 0.76, 0.36),    # harmonic lyre gold
        "emissive": (0.06, 0.24, 0.32),
    },
    {
        "id": "TP-003",
        "name": "Caliban",
        "house": "The Tempest",
        "motif": "Sycorax Island Basalt Fang Crags, Twisted Sea-Coral Spires & Sunken Iron Ring",
        "primary": (0.26, 0.56, 0.34),   # sea-moss stone green
        "secondary": (0.28, 0.27, 0.30), # volcanic island basalt
        "accent": (0.88, 0.38, 0.30),    # wild reef coral
        "emissive": (0.04, 0.14, 0.08),
    },
    {
        "id": "MO-003",
        "name": "Benvolio",
        "house": "Montague",
        "motif": "Verona Dawn Buckler Shield, Sheathed Peacekeeper Blade & Ascending Silver Dove",
        "primary": (0.30, 0.64, 0.92),   # dawn plaza sky-blue
        "secondary": (0.86, 0.89, 0.93), # peacekeeper silver
        "accent": (0.68, 0.78, 0.30),    # olive branch gold-green
        "emissive": (0.05, 0.12, 0.22),
    },
    {
        "id": "CA-002",
        "name": "Tybalt",
        "house": "Capulet",
        "motif": "Prince of Cats Crested Rapier Hilt, Blazing Torch Brazier & Spiral Flame Tongues",
        "primary": (0.88, 0.18, 0.14),   # Capulet duel red
        "secondary": (0.22, 0.22, 0.26), # blackened rapier steel
        "accent": (0.98, 0.58, 0.12),    # alley torch flame
        "emissive": (0.30, 0.08, 0.02),
    },
    {
        "id": "DC-003",
        "name": "King Claudius",
        "house": "Danish Court",
        "motif": "Usurper's Jagged Crown Constricted by Coiled Bronze Serpent & Hebona Poison Vial",
        "primary": (0.16, 0.64, 0.36),   # cursed hebona emerald
        "secondary": (0.80, 0.64, 0.18), # tarnished Elsinore crown
        "accent": (0.48, 0.88, 0.24),    # venom drop chartreuse
        "emissive": (0.04, 0.22, 0.06),
    },
    {
        "id": "FA-003",
        "name": "Oberon",
        "house": "Forest of Arden",
        "motif": "Moonlit Ten-Point Silver Stag-Antler Crown, Crescent Moon & Dewdrop Crystal",
        "primary": (0.48, 0.28, 0.86),   # midnight glade violet
        "secondary": (0.86, 0.88, 0.95), # silver stag antlers
        "accent": (0.68, 0.52, 0.98),    # Oberon dewdrop amethyst
        "emissive": (0.12, 0.06, 0.28),
    },
]


# ---------------------------------------------------------------------------
# Procedural Tangent-Space Normal Map (128x128 tileable PNG, ~18 KB)
# ---------------------------------------------------------------------------
def build_normal_map_png(out_path: Path, size: int = 128) -> None:
    """Write a deterministic, tileable 128x128 tangent-space normal map PNG
    combining fine brushed-metal grain and subtle carved-stone micro-facets."""
    import zlib

    def height_at(ix: int, iy: int) -> float:
        u = (ix % size) / size * 2.0 * math.pi
        v = (iy % size) / size * 2.0 * math.pi
        grain = 0.35 * math.sin(12.0 * u + 2.0 * math.cos(3.0 * v))
        weave = 0.25 * math.cos(8.0 * u - 8.0 * v) * math.sin(6.0 * v)
        facets = 0.20 * math.sin(5.0 * u) * math.cos(7.0 * v)
        micro = 0.12 * math.sin(23.0 * u + 17.0 * v)
        return grain + weave + facets + micro

    rows = []
    strength = 1.35
    for y in range(size):
        row = bytearray([0])  # PNG filter type 0 (None)
        for x in range(size):
            dx = (height_at(x + 1, y) - height_at(x - 1, y)) * strength
            dy = (height_at(x, y + 1) - height_at(x, y - 1)) * strength
            nx, ny, nz = -dx, -dy, 1.0
            inv = 1.0 / math.sqrt(nx * nx + ny * ny + nz * nz)
            r = max(0, min(255, int(round((nx * inv * 0.5 + 0.5) * 255.0))))
            g = max(0, min(255, int(round((ny * inv * 0.5 + 0.5) * 255.0))))
            b = max(0, min(255, int(round((nz * inv * 0.5 + 0.5) * 255.0))))
            row.extend((r, g, b))
        rows.append(bytes(row))

    raw = b"".join(rows)

    def chunk(tag: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    idat = zlib.compress(raw, level=9)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")
    out_path.write_bytes(png)


# ---------------------------------------------------------------------------
# PBR Materials with Shared Embedded Normal Map
# ---------------------------------------------------------------------------
def clear_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def load_shared_normal_image() -> bpy.types.Image:
    if not NORMAL_MAP_PATH.exists():
        build_normal_map_png(NORMAL_MAP_PATH, 128)
    img = bpy.data.images.load(str(NORMAL_MAP_PATH))
    img.colorspace_settings.name = "Non-Color"
    img.pack()
    return img


def make_pbr_mat(
    name: str,
    base_color: tuple[float, float, float],
    metallic: float,
    roughness: float,
    normal_img: bpy.types.Image,
    normal_strength: float = 0.25,
    emissive: tuple[float, float, float] | None = None,
    emissive_strength: float = 0.0,
) -> bpy.types.Material:
    mat = bpy.data.materials.new(name=name)
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (*base_color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emissive and emissive_strength > 0.0:
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = (*emissive, 1.0)
            bsdf.inputs["Emission Strength"].default_value = emissive_strength

    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = normal_img
    nmap = nt.nodes.new("ShaderNodeNormalMap")
    nmap.inputs["Strength"].default_value = normal_strength

    nt.links.new(tex.outputs["Color"], nmap.inputs["Color"])
    nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


# ---------------------------------------------------------------------------
# Closed 2-Manifold BMesh Builders (Guaranteed Watertight Solids)
# ---------------------------------------------------------------------------
class TrophyBuilder:
    """Accumulates watertight closed bmesh solids with material indices and cylindrical/box UVs."""

    def __init__(self, materials: list[bpy.types.Material]):
        self.bm = bmesh.new()
        self.uv_layer = self.bm.loops.layers.uv.new("UVMap")
        self.materials = materials

    def _tag_geom(self, verts: list[bmesh.types.BMVert], mat_idx: int, matrix: Matrix | None = None) -> list[bmesh.types.BMVert]:
        verts = list({v for v in verts if v.is_valid})
        if matrix is not None:
            bmesh.ops.transform(self.bm, matrix=matrix, verts=verts)
        vert_set = set(verts)
        faces = [f for f in self.bm.faces if all(v in vert_set for v in f.verts)]
        for f in faces:
            f.material_index = mat_idx
            f.smooth = True
            n = f.normal
            for loop in f.loops:
                co = loop.vert.co
                if abs(n.z) > 0.72:
                    u, v = co.x * 0.8 + 0.5, co.y * 0.8 + 0.5
                else:
                    ang = math.atan2(co.y, co.x) / (2.0 * math.pi) + 0.5
                    u, v = ang * 2.0, co.z * 0.8
                loop[self.uv_layer].uv = (u, v)
        return verts

    def add_cylinder(
        self,
        r1: float,
        r2: float,
        depth: float,
        segs: int = 24,
        mat: int = 0,
        loc: tuple[float, float, float] = (0.0, 0.0, 0.0),
        rot_euler: tuple[float, float, float] = (0.0, 0.0, 0.0),
        scale: tuple[float, float, float] = (1.0, 1.0, 1.0),
    ) -> list[bmesh.types.BMVert]:
        res = bmesh.ops.create_cone(
            self.bm,
            cap_ends=True,
            cap_tris=True,
            segments=segs,
            radius1=r1,
            radius2=r2,
            depth=depth,
        )
        m = Matrix.Translation(loc) @ Euler(rot_euler, "XYZ").to_matrix().to_4x4() @ Matrix.Diagonal((*scale, 1.0))
        return self._tag_geom(res["verts"], mat, m)

    def add_box(
        self,
        size: tuple[float, float, float],
        mat: int = 0,
        loc: tuple[float, float, float] = (0.0, 0.0, 0.0),
        rot_euler: tuple[float, float, float] = (0.0, 0.0, 0.0),
        bevel: float = 0.0,
    ) -> list[bmesh.types.BMVert]:
        res = bmesh.ops.create_cube(self.bm, size=1.0)
        verts = res["verts"]
        bmesh.ops.scale(self.bm, vec=size, verts=verts)
        if bevel > 0.0:
            vert_set = set(verts)
            edges = [e for e in self.bm.edges if e.verts[0] in vert_set and e.verts[1] in vert_set]
            bv = bmesh.ops.bevel(self.bm, geom=edges, offset=bevel, segments=2, profile=0.5, affect="EDGES")
            verts = [v for v in (list(bv["verts"]) + list(vert_set)) if v.is_valid]
        m = Matrix.Translation(loc) @ Euler(rot_euler, "XYZ").to_matrix().to_4x4()
        return self._tag_geom(verts, mat, m)

    def add_sphere(
        self,
        radius: float,
        u_segs: int = 20,
        v_segs: int = 12,
        mat: int = 0,
        loc: tuple[float, float, float] = (0.0, 0.0, 0.0),
        rot_euler: tuple[float, float, float] = (0.0, 0.0, 0.0),
        scale: tuple[float, float, float] = (1.0, 1.0, 1.0),
    ) -> list[bmesh.types.BMVert]:
        res = bmesh.ops.create_uvsphere(self.bm, u_segments=u_segs, v_segments=v_segs, radius=radius)
        m = Matrix.Translation(loc) @ Euler(rot_euler, "XYZ").to_matrix().to_4x4() @ Matrix.Diagonal((*scale, 1.0))
        return self._tag_geom(res["verts"], mat, m)

    def add_icosphere(
        self,
        radius: float,
        subdivisions: int = 2,
        mat: int = 0,
        loc: tuple[float, float, float] = (0.0, 0.0, 0.0),
        rot_euler: tuple[float, float, float] = (0.0, 0.0, 0.0),
        scale: tuple[float, float, float] = (1.0, 1.0, 1.0),
    ) -> list[bmesh.types.BMVert]:
        res = bmesh.ops.create_icosphere(self.bm, subdivisions=subdivisions, radius=radius)
        m = Matrix.Translation(loc) @ Euler(rot_euler, "XYZ").to_matrix().to_4x4() @ Matrix.Diagonal((*scale, 1.0))
        return self._tag_geom(res["verts"], mat, m)

    def add_torus(
        self,
        major_r: float,
        minor_r: float,
        major_segs: int = 28,
        minor_segs: int = 12,
        arc: float = 2.0 * math.pi,
        twist_z: float = 0.0,
        taper_end: float = 1.0,
        mat: int = 0,
        loc: tuple[float, float, float] = (0.0, 0.0, 0.0),
        rot_euler: tuple[float, float, float] = (0.0, 0.0, 0.0),
        scale: tuple[float, float, float] = (1.0, 1.0, 1.0),
    ) -> list[bmesh.types.BMVert]:
        """Closed torus (when arc == 2*pi) or capped arc tube (when arc < 2*pi)."""
        full = abs(arc - 2.0 * math.pi) < 1e-4 and abs(twist_z) < 1e-5 and abs(taper_end - 1.0) < 1e-4
        rings: list[list[bmesh.types.BMVert]] = []
        created_verts: list[bmesh.types.BMVert] = []
        steps = major_segs if full else major_segs + 1
        for i in range(steps):
            t = i / major_segs
            theta = t * arc
            r_here = minor_r * (1.0 * (1.0 - t) + taper_end * t)
            center = Vector((major_r * math.cos(theta), major_r * math.sin(theta), twist_z * (t - 0.5)))
            radial = Vector((math.cos(theta), math.sin(theta), 0.0))
            up = Vector((0.0, 0.0, 1.0))
            ring = []
            for j in range(minor_segs):
                phi = (j / minor_segs) * 2.0 * math.pi
                pt = center + radial * (r_here * math.cos(phi)) + up * (r_here * math.sin(phi))
                v = self.bm.verts.new(pt)
                ring.append(v)
                created_verts.append(v)
            rings.append(ring)

        ring_count = len(rings)
        limit = ring_count if full else ring_count - 1
        for i in range(limit):
            r_a = rings[i]
            r_b = rings[(i + 1) % ring_count]
            for j in range(minor_segs):
                jn = (j + 1) % minor_segs
                self.bm.faces.new((r_a[j], r_b[j], r_b[jn], r_a[jn]))

        if not full:
            # Cap start and end rings with triangle fans to center vertices (100% watertight!)
            start_c = sum((v.co for v in rings[0]), Vector()) / minor_segs
            sv = self.bm.verts.new(start_c)
            created_verts.append(sv)
            for j in range(minor_segs):
                jn = (j + 1) % minor_segs
                self.bm.faces.new((sv, rings[0][jn], rings[0][j]))

            end_c = sum((v.co for v in rings[-1]), Vector()) / minor_segs
            ev = self.bm.verts.new(end_c)
            created_verts.append(ev)
            for j in range(minor_segs):
                jn = (j + 1) % minor_segs
                self.bm.faces.new((ev, rings[-1][j], rings[-1][jn]))

        m = Matrix.Translation(loc) @ Euler(rot_euler, "XYZ").to_matrix().to_4x4() @ Matrix.Diagonal((*scale, 1.0))
        return self._tag_geom(created_verts, mat, m)

    def add_lathe(
        self,
        profile_rz: list[tuple[float, float]],
        segs: int = 24,
        mat: int = 0,
        loc: tuple[float, float, float] = (0.0, 0.0, 0.0),
        rot_euler: tuple[float, float, float] = (0.0, 0.0, 0.0),
        scale: tuple[float, float, float] = (1.0, 1.0, 1.0),
    ) -> list[bmesh.types.BMVert]:
        """Revolve a profile [(r, z), ...] around Z into a closed watertight solid."""
        rings: list[list[bmesh.types.BMVert]] = []
        created: list[bmesh.types.BMVert] = []
        for r, z in profile_rz:
            r_safe = max(0.004, r)
            ring = []
            for j in range(segs):
                ang = (j / segs) * 2.0 * math.pi
                v = self.bm.verts.new((r_safe * math.cos(ang), r_safe * math.sin(ang), z))
                ring.append(v)
                created.append(v)
            rings.append(ring)

        for i in range(len(rings) - 1):
            ra, rb = rings[i], rings[i + 1]
            for j in range(segs):
                jn = (j + 1) % segs
                self.bm.faces.new((ra[j], rb[j], rb[jn], ra[jn]))

        bot_v = self.bm.verts.new((0.0, 0.0, profile_rz[0][1]))
        top_v = self.bm.verts.new((0.0, 0.0, profile_rz[-1][1]))
        created.extend((bot_v, top_v))
        for j in range(segs):
            jn = (j + 1) % segs
            self.bm.faces.new((bot_v, rings[0][jn], rings[0][j]))
            self.bm.faces.new((top_v, rings[-1][j], rings[-1][jn]))

        m = Matrix.Translation(loc) @ Euler(rot_euler, "XYZ").to_matrix().to_4x4() @ Matrix.Diagonal((*scale, 1.0))
        return self._tag_geom(created, mat, m)

    def add_collector_plinth(self) -> None:
        """Carved octagonal obsidian-and-brass Inspired Mile Collector Plinth (y_up -> z_up [0..0.28]).
        Materials: 0=Obsidian, 1=Brass, 2=Primary House Enamel, 3=Secondary, 4=Accent/Glow."""
        # Stepped octagonal obsidian base
        self.add_cylinder(0.46, 0.43, 0.07, segs=8, mat=0, loc=(0.0, 0.0, 0.035))
        # Lower brass trim molding
        self.add_cylinder(0.435, 0.415, 0.025, segs=16, mat=1, loc=(0.0, 0.0, 0.082))
        # Waist carved obsidian drum
        self.add_cylinder(0.39, 0.36, 0.11, segs=16, mat=0, loc=(0.0, 0.0, 0.145))
        # House enamel inlaid ring
        self.add_torus(0.378, 0.018, major_segs=24, minor_segs=10, mat=2, loc=(0.0, 0.0, 0.145))
        # Upper brass gallery dais
        self.add_cylinder(0.38, 0.40, 0.03, segs=16, mat=1, loc=(0.0, 0.0, 0.215))
        # Top stage medallion plate
        self.add_cylinder(0.36, 0.34, 0.03, segs=24, mat=0, loc=(0.0, 0.0, 0.245))
        # 8 cardinal brass studs around base
        for k in range(8):
            ang = (k / 8.0) * 2.0 * math.pi + math.pi / 8.0
            self.add_sphere(0.020, u_segs=10, v_segs=8, mat=1, loc=(0.405 * math.cos(ang), 0.405 * math.sin(ang), 0.075))

    def finalize_object(self, name: str) -> tuple[bpy.types.Object, dict]:
        bmesh.ops.triangulate(self.bm, faces=self.bm.faces[:])
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces[:])
        self.bm.verts.ensure_lookup_table()
        self.bm.edges.ensure_lookup_table()
        self.bm.faces.ensure_lookup_table()

        non_manifold = sum(1 for e in self.bm.edges if not e.is_manifold)
        boundary = sum(1 for e in self.bm.edges if e.is_boundary)
        verts_n = len(self.bm.verts)
        tris_n = len(self.bm.faces)

        if non_manifold != 0 or boundary != 0:
            raise RuntimeError(f"{name}: mesh is not watertight! non_manifold={non_manifold}, boundary={boundary}")

        mesh = bpy.data.meshes.new(name)
        self.bm.to_mesh(mesh)
        self.bm.free()

        for mat in self.materials:
            mesh.materials.append(mat)

        # Smooth normals with crisp bevel shading
        for poly in mesh.polygons:
            poly.use_smooth = True

        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        stats = {
            "vertices": verts_n,
            "triangles": tris_n,
            "non_manifold_edges": non_manifold,
            "boundary_edges": boundary,
            "watertight": non_manifold == 0 and boundary == 0,
        }
        return obj, stats


# ---------------------------------------------------------------------------
# Bespoke Sculptural Centerpieces for All 18 Cards (z >= 0.26)
# ---------------------------------------------------------------------------
def sculpt_motif(tb: TrophyBuilder, card_id: str) -> None:
    """Materials: 0=Obsidian, 1=Antique Brass, 2=Primary, 3=Secondary, 4=Accent/Glow."""
    z0 = 0.26

    if card_id == "SM-001":
        # THE RING STAGE EMBLEM (Zero human likeness — D-13, D-14, R8):
        # Golden Spotlight Stage Ring + Vintage Ribbed Brass Hip-Hop Microphone + Open Quarto Folio + Flame Tongues
        tb.add_torus(0.32, 0.026, major_segs=32, minor_segs=12, mat=2, loc=(0.0, 0.0, z0 + 0.38), rot_euler=(math.pi / 2, 0.0, 0.0))
        # Spotlight halo inner ring
        tb.add_torus(0.285, 0.010, major_segs=28, minor_segs=8, mat=4, loc=(0.0, 0.0, z0 + 0.38), rot_euler=(math.pi / 2, 0.0, 0.0))
        # Angled microphone stand column + weighted stage base
        tb.add_cylinder(0.11, 0.09, 0.04, segs=20, mat=1, loc=(-0.03, 0.0, z0 + 0.02))
        tb.add_cylinder(0.022, 0.018, 0.42, segs=16, mat=1, loc=(-0.02, 0.0, z0 + 0.23), rot_euler=(0.0, 0.14, 0.0))
        # Classic vintage studio/stage microphone yoke & pill capsule
        tb.add_torus(0.075, 0.012, major_segs=18, minor_segs=8, arc=math.pi, mat=1, loc=(0.01, 0.0, z0 + 0.46), rot_euler=(math.pi / 2, 0.0, math.pi / 2))
        tb.add_sphere(0.062, u_segs=20, v_segs=14, mat=2, loc=(0.01, 0.0, z0 + 0.50), rot_euler=(0.0, -0.22, 0.0), scale=(1.0, 0.88, 1.32))
        # 5 vintage horizontal grille ribs around microphone capsule
        for r_i in range(-2, 3):
            zz = z0 + 0.50 + r_i * 0.019
            rr = 0.060 * math.sqrt(max(0.25, 1.0 - (r_i * 0.28) ** 2))
            tb.add_torus(rr, 0.0055, major_segs=18, minor_segs=6, mat=1, loc=(0.01, 0.0, zz), rot_euler=(0.0, -0.22, 0.0))
        # Open Shakespeare Quarto / First Folio resting on front brass lectern
        tb.add_box((0.18, 0.13, 0.022), mat=3, loc=(0.09, -0.09, z0 + 0.08), rot_euler=(0.38, -0.18, 0.22), bevel=0.004)
        tb.add_box((0.16, 0.058, 0.016), mat=4, loc=(0.055, -0.085, z0 + 0.095), rot_euler=(0.38, -0.34, 0.22), bevel=0.003)
        tb.add_box((0.16, 0.058, 0.016), mat=4, loc=(0.125, -0.095, z0 + 0.095), rot_euler=(0.38, -0.02, 0.22), bevel=0.003)
        # 6 sculpted stage-fire flame tongues around the ring base
        for k in range(6):
            ang = (k / 6.0) * 2.0 * math.pi + 0.3
            tb.add_torus(0.07, 0.016, major_segs=12, minor_segs=8, arc=math.pi * 0.75, twist_z=0.10, taper_end=0.18, mat=3 if k % 2 else 4,
                         loc=(0.23 * math.cos(ang), 0.23 * math.sin(ang), z0 + 0.09), rot_euler=(math.pi / 2, 0.2, ang))

    elif card_id == "MO-001":
        # Romeo: Verona Balcony Balustrade + Climbing Crimson Rose + Golden Vow Ring
        for bx in (-0.15, -0.05, 0.05, 0.15):
            tb.add_lathe([(0.028, 0.0), (0.018, 0.05), (0.032, 0.12), (0.016, 0.20), (0.026, 0.25)], segs=14, mat=3, loc=(bx, 0.06, z0))
        tb.add_box((0.40, 0.11, 0.036), mat=3, loc=(0.0, 0.06, z0 + 0.265), bevel=0.006)
        # Climbing rose stem & layered crimson petals
        tb.add_torus(0.16, 0.016, major_segs=18, minor_segs=8, arc=math.pi * 1.15, twist_z=0.28, taper_end=0.55, mat=1, loc=(-0.02, -0.04, z0 + 0.22), rot_euler=(1.2, 0.2, 0.4))
        for p in range(7):
            ang = (p / 7.0) * 2.0 * math.pi
            tb.add_sphere(0.068, u_segs=14, v_segs=10, mat=2, loc=(0.045 * math.cos(ang), -0.05 + 0.045 * math.sin(ang), z0 + 0.43),
                          rot_euler=(0.45 * math.sin(ang), 0.45 * math.cos(ang), ang), scale=(1.0, 0.42, 1.18))
        tb.add_sphere(0.045, u_segs=14, v_segs=10, mat=2, loc=(0.0, -0.05, z0 + 0.44), scale=(0.9, 0.9, 1.2))
        # Romeo's inscribed golden vow ring perched on balustrade
        tb.add_torus(0.062, 0.015, major_segs=24, minor_segs=10, mat=4, loc=(0.11, -0.02, z0 + 0.33), rot_euler=(1.05, 0.25, -0.35))

    elif card_id == "CA-001":
        # Juliet: Crescent-Moon Garden Trellis + Capulet Rose + Silver Nightingale
        tb.add_torus(0.27, 0.028, major_segs=28, minor_segs=10, arc=math.pi * 1.38, taper_end=0.25, mat=2,
                     loc=(0.0, 0.0, z0 + 0.34), rot_euler=(math.pi / 2, 0.0, 0.35))
        # Perched nightingale songbird on crescent arch
        tb.add_sphere(0.068, u_segs=16, v_segs=12, mat=4, loc=(0.05, 0.0, z0 + 0.41), rot_euler=(0.0, -0.35, 0.2), scale=(1.35, 0.72, 0.82))
        tb.add_sphere(0.038, u_segs=14, v_segs=10, mat=4, loc=(0.125, 0.01, z0 + 0.455), scale=(1.05, 0.88, 0.95))
        tb.add_cylinder(0.014, 0.002, 0.045, segs=10, mat=1, loc=(0.17, 0.015, z0 + 0.46), rot_euler=(0.0, math.pi / 2 - 0.15, 0.1))
        tb.add_box((0.11, 0.045, 0.012), mat=4, loc=(-0.04, 0.0, z0 + 0.37), rot_euler=(0.1, 0.45, 0.2), bevel=0.003)
        # Twin garden roses at base
        for rx, rz in ((-0.10, z0 + 0.11), (0.09, z0 + 0.09)):
            for p in range(5):
                a = (p / 5.0) * 2.0 * math.pi
                tb.add_sphere(0.045, u_segs=12, v_segs=8, mat=3, loc=(rx + 0.025 * math.cos(a), -0.06 + 0.025 * math.sin(a), rz),
                              rot_euler=(0.3 * math.sin(a), 0.3 * math.cos(a), a), scale=(1.0, 0.45, 1.1))

    elif card_id == "DC-001":
        # Hamlet: Elsinore Battlement + Crowned Stylized Yorick Skull + Swept-Hilt Rapier
        for crenel in range(6):
            ang = (crenel / 6.0) * 2.0 * math.pi
            tb.add_box((0.075, 0.055, 0.08), mat=2, loc=(0.24 * math.cos(ang), 0.24 * math.sin(ang), z0 + 0.04), rot_euler=(0.0, 0.0, ang), bevel=0.005)
        # Stylized theatrical Yorick cranium + cheekbone + jaw
        tb.add_sphere(0.155, u_segs=22, v_segs=16, mat=3, loc=(0.0, 0.0, z0 + 0.27), scale=(0.92, 1.06, 1.02))
        tb.add_box((0.15, 0.13, 0.10), mat=3, loc=(0.0, -0.045, z0 + 0.13), bevel=0.022)
        # Obsidian ocular sockets & nasal hollow (protruding dark inset bezels, watertight!)
        for sx in (-0.058, 0.058):
            tb.add_torus(0.036, 0.011, major_segs=16, minor_segs=8, mat=0, loc=(sx, -0.135, z0 + 0.255), rot_euler=(1.35, 0.0, 0.0))
            tb.add_sphere(0.030, u_segs=12, v_segs=8, mat=0, loc=(sx, -0.125, z0 + 0.255), scale=(1.0, 0.45, 1.0))
        # Tilted Danish jagged crown
        tb.add_torus(0.125, 0.018, major_segs=24, minor_segs=8, mat=4, loc=(0.0, 0.01, z0 + 0.40), rot_euler=(0.12, -0.16, 0.0))
        for sp in range(6):
            a = (sp / 6.0) * 2.0 * math.pi
            tb.add_cylinder(0.022, 0.003, 0.075, segs=8, mat=4, loc=(0.125 * math.cos(a), 0.01 + 0.125 * math.sin(a), z0 + 0.44), rot_euler=(0.12, -0.16, 0.0))
        # Diagonal swept-hilt rapier behind skull
        tb.add_cylinder(0.014, 0.003, 0.72, segs=12, mat=1, loc=(0.0, 0.08, z0 + 0.34), rot_euler=(0.0, 0.52, 0.0))
        tb.add_torus(0.075, 0.012, major_segs=18, minor_segs=8, mat=4, loc=(-0.15, 0.08, z0 + 0.58), rot_euler=(math.pi / 2, 0.52, 0.0))
        tb.add_box((0.22, 0.022, 0.022), mat=4, loc=(-0.15, 0.08, z0 + 0.58), rot_euler=(0.0, 0.52, 0.0), bevel=0.004)

    elif card_id == "DC-002":
        # Ophelia: Concentric Water Ripples + Weeping Willow Arch + Rosemary Remembrance Chalice
        for r_ring in (0.14, 0.22, 0.30):
            tb.add_torus(r_ring, 0.014, major_segs=24, minor_segs=8, mat=2, loc=(0.0, 0.0, z0 + 0.02))
        # Chalice of remembrance
        tb.add_lathe([(0.09, 0.0), (0.032, 0.05), (0.026, 0.16), (0.12, 0.24), (0.135, 0.31), (0.095, 0.315)], segs=22, mat=4, loc=(0.0, 0.0, z0 + 0.02))
        # Floating rosemary & wildflower botanical wreath
        tb.add_torus(0.18, 0.022, major_segs=24, minor_segs=10, mat=3, loc=(0.0, 0.0, z0 + 0.37), rot_euler=(0.35, 0.15, 0.0))
        for k in range(8):
            a = (k / 8.0) * 2.0 * math.pi
            tb.add_sphere(0.036, u_segs=12, v_segs=8, mat=4 if k % 2 == 0 else 2,
                          loc=(0.18 * math.cos(a), 0.18 * math.sin(a), z0 + 0.37 + 0.06 * math.sin(a)), scale=(1.2, 0.7, 0.8))
        # Willow bough arch
        tb.add_torus(0.27, 0.018, major_segs=24, minor_segs=8, arc=math.pi, mat=3, loc=(0.0, 0.05, z0 + 0.26), rot_euler=(math.pi / 2, 0.0, 0.0))

    elif card_id == "MO-002":
        # Mercutio: Twin Crossed Verona Rapiers + Queen Mab Carnival Mask + Wind Sparks
        for sgn in (-1.0, 1.0):
            tb.add_cylinder(0.015, 0.003, 0.68, segs=12, mat=3, loc=(0.0, 0.03, z0 + 0.34), rot_euler=(0.0, sgn * 0.48, 0.0))
            tb.add_torus(0.068, 0.012, major_segs=16, minor_segs=8, mat=4, loc=(-sgn * 0.12, 0.03, z0 + 0.14), rot_euler=(math.pi / 2, sgn * 0.48, 0.0))
            tb.add_box((0.19, 0.022, 0.020), mat=4, loc=(-sgn * 0.12, 0.03, z0 + 0.14), rot_euler=(0.0, sgn * 0.48, 0.0), bevel=0.003)
        # Queen Mab sculpted masquerade visor crest
        tb.add_sphere(0.13, u_segs=20, v_segs=12, mat=2, loc=(0.0, -0.04, z0 + 0.33), scale=(1.35, 0.38, 0.78))
        tb.add_cylinder(0.022, 0.004, 0.09, segs=10, mat=4, loc=(0.0, -0.095, z0 + 0.31), rot_euler=(1.35, 0.0, 0.0))
        for sx in (-0.065, 0.065):
            tb.add_torus(0.032, 0.008, major_segs=14, minor_segs=8, mat=4, loc=(sx, -0.082, z0 + 0.345), rot_euler=(math.pi / 2, 0.0, sgn * 0.2))
        # Swirling wind ribbon
        tb.add_torus(0.24, 0.014, major_segs=24, minor_segs=8, arc=math.pi * 1.45, twist_z=0.34, taper_end=0.25, mat=4, loc=(0.0, 0.0, z0 + 0.28))

    elif card_id == "FA-001":
        # Puck: Horned Woodland Trickster Crest + Love-in-Idleness Flower + Pixie Orbs
        tb.add_cylinder(0.14, 0.09, 0.16, segs=14, mat=3, loc=(0.0, 0.02, z0 + 0.08))
        tb.add_sphere(0.135, u_segs=20, v_segs=14, mat=2, loc=(0.0, -0.02, z0 + 0.27), scale=(1.12, 0.55, 1.05))
        # Curled satyr/pan horns
        for sgn in (-1.0, 1.0):
            tb.add_torus(0.11, 0.026, major_segs=18, minor_segs=10, arc=math.pi * 1.15, twist_z=0.08, taper_end=0.18, mat=1,
                         loc=(sgn * 0.11, 0.0, z0 + 0.38), rot_euler=(0.4, sgn * 0.5, sgn * 0.8))
        # Enchanted 5-petal purple blossom at crown
        for p in range(5):
            a = (p / 5.0) * 2.0 * math.pi
            tb.add_sphere(0.044, u_segs=12, v_segs=8, mat=4, loc=(0.042 * math.cos(a), -0.04 + 0.02 * math.sin(a), z0 + 0.44 + 0.03 * math.sin(a)), scale=(1.0, 0.4, 1.2))
        for k in range(5):
            a = (k / 5.0) * 2.0 * math.pi
            tb.add_icosphere(0.024, subdivisions=1, mat=4, loc=(0.24 * math.cos(a), 0.24 * math.sin(a), z0 + 0.18 + 0.06 * k))

    elif card_id == "FA-002":
        # Titania: Living-Vine Fairy Throne + Blossom Diadem + Firefly Canopy
        tb.add_cylinder(0.18, 0.15, 0.12, segs=16, mat=2, loc=(0.0, 0.0, z0 + 0.06))
        # High arched vine backrest
        tb.add_torus(0.22, 0.026, major_segs=26, minor_segs=10, arc=math.pi * 1.2, mat=2, loc=(0.0, 0.06, z0 + 0.28), rot_euler=(math.pi / 2, 0.0, -0.3))
        tb.add_torus(0.17, 0.018, major_segs=22, minor_segs=8, arc=math.pi * 1.1, mat=1, loc=(0.0, 0.06, z0 + 0.28), rot_euler=(math.pi / 2, 0.0, -0.15))
        # Fairy Queen Diadem floating over seat
        tb.add_torus(0.11, 0.016, major_segs=24, minor_segs=8, mat=3, loc=(0.0, -0.02, z0 + 0.24))
        for k in range(7):
            a = (k / 7.0) * math.pi
            tb.add_sphere(0.026, u_segs=10, v_segs=8, mat=4, loc=(0.11 * math.cos(a), -0.02 - 0.11 * math.sin(a), z0 + 0.28 + 0.03 * math.sin(a)), scale=(0.7, 0.7, 1.6))
        for k in range(4):
            a = (k / 4.0) * 2.0 * math.pi + 0.4
            tb.add_sphere(0.022, u_segs=10, v_segs=8, mat=3, loc=(0.24 * math.cos(a), 0.24 * math.sin(a), z0 + 0.42))

    elif card_id == "VC-001":
        # Prince Escalus: Imperial Scepter + Balanced Judicial Scales of Verona
        tb.add_lathe([(0.075, 0.0), (0.035, 0.06), (0.026, 0.38), (0.055, 0.46), (0.028, 0.54)], segs=20, mat=2, loc=(0.0, 0.0, z0))
        tb.add_sphere(0.062, u_segs=18, v_segs=12, mat=4, loc=(0.0, 0.0, z0 + 0.56))
        tb.add_torus(0.082, 0.012, major_segs=22, minor_segs=8, mat=1, loc=(0.0, 0.0, z0 + 0.56), rot_euler=(0.5, 0.4, 0.0))
        # Crossbeam & twin scale pans
        tb.add_box((0.46, 0.028, 0.028), mat=2, loc=(0.0, 0.0, z0 + 0.40), bevel=0.005)
        for sgn in (-1.0, 1.0):
            tb.add_cylinder(0.008, 0.008, 0.16, segs=8, mat=1, loc=(sgn * 0.20, 0.0, z0 + 0.31))
            tb.add_lathe([(0.02, 0.0), (0.088, 0.025), (0.095, 0.045), (0.075, 0.048)], segs=18, mat=3, loc=(sgn * 0.20, 0.0, z0 + 0.20))

    elif card_id == "VC-002":
        # Friar Lawrence: Monastery Mortar & Pestle + Amber Apothecary Vial + Beeswax Candle
        tb.add_lathe([(0.10, 0.0), (0.145, 0.09), (0.16, 0.17), (0.125, 0.19), (0.09, 0.14)], segs=20, mat=2, loc=(-0.06, 0.02, z0))
        tb.add_cylinder(0.026, 0.018, 0.24, segs=12, mat=1, loc=(-0.02, 0.02, z0 + 0.22), rot_euler=(0.25, 0.42, 0.0))
        # Stoppered elixir flask
        tb.add_lathe([(0.065, 0.0), (0.095, 0.08), (0.032, 0.17), (0.042, 0.22), (0.028, 0.26)], segs=18, mat=3, loc=(0.13, -0.05, z0))
        # Cloister candle + sculpted flame
        tb.add_cylinder(0.036, 0.032, 0.26, segs=14, mat=1, loc=(0.09, 0.11, z0 + 0.13))
        tb.add_sphere(0.028, u_segs=12, v_segs=10, mat=3, loc=(0.09, 0.11, z0 + 0.29), scale=(0.75, 0.75, 1.65))
        # Herb wreath ring
        tb.add_torus(0.25, 0.018, major_segs=22, minor_segs=8, mat=4, loc=(0.0, 0.0, z0 + 0.025))

    elif card_id == "VC-003":
        # The Nurse: Wax-Sealed Secret Scroll + Coiled Rope-Ladder + Ornate Brass Key
        tb.add_cylinder(0.052, 0.052, 0.36, segs=18, mat=3, loc=(0.0, -0.02, z0 + 0.20), rot_euler=(0.25, 0.68, 0.2))
        tb.add_cylinder(0.062, 0.062, 0.03, segs=18, mat=1, loc=(-0.11, -0.05, z0 + 0.09), rot_euler=(0.25, 0.68, 0.2))
        tb.add_cylinder(0.062, 0.062, 0.03, segs=18, mat=1, loc=(0.11, 0.01, z0 + 0.31), rot_euler=(0.25, 0.68, 0.2))
        # Crimson heart wax seal
        tb.add_cylinder(0.048, 0.044, 0.022, segs=16, mat=2, loc=(0.02, -0.065, z0 + 0.21), rot_euler=(1.2, 0.2, 0.0))
        # Coiled rope ladder rings
        for k in range(3):
            tb.add_torus(0.19 - k * 0.022, 0.018, major_segs=22, minor_segs=8, mat=1, loc=(0.0, 0.03, z0 + 0.022 + k * 0.03))
        # Ornate chatelaine brass key
        tb.add_torus(0.062, 0.014, major_segs=18, minor_segs=8, mat=4, loc=(-0.09, 0.08, z0 + 0.39), rot_euler=(math.pi / 2, 0.0, 0.3))
        tb.add_cylinder(0.013, 0.013, 0.24, segs=10, mat=4, loc=(-0.09, 0.08, z0 + 0.21))
        tb.add_box((0.05, 0.016, 0.045), mat=4, loc=(-0.065, 0.08, z0 + 0.12), bevel=0.003)

    elif card_id == "TP-001":
        # Prospero: Spiraled Gnarlwood Staff + Storm Armillary Rings + Open Codex
        tb.add_cylinder(0.028, 0.018, 0.62, segs=14, mat=3, loc=(0.0, 0.0, z0 + 0.31))
        tb.add_torus(0.055, 0.014, major_segs=20, minor_segs=8, arc=math.pi * 1.8, twist_z=0.36, taper_end=0.5, mat=3, loc=(0.0, 0.0, z0 + 0.36))
        # Arcane crystal orb & interlocking storm armillary rings
        tb.add_icosphere(0.068, subdivisions=2, mat=4, loc=(0.0, 0.0, z0 + 0.56))
        tb.add_torus(0.16, 0.014, major_segs=26, minor_segs=8, mat=1, loc=(0.0, 0.0, z0 + 0.52), rot_euler=(0.65, 0.35, 0.0))
        tb.add_torus(0.20, 0.012, major_segs=26, minor_segs=8, mat=2, loc=(0.0, 0.0, z0 + 0.52), rot_euler=(-0.55, 0.75, 0.4))
        # Open Tempest Codex at base
        tb.add_box((0.20, 0.14, 0.032), mat=2, loc=(0.0, -0.10, z0 + 0.05), rot_euler=(0.35, 0.0, 0.0), bevel=0.005)

    elif card_id == "TP-002":
        # Ariel: Ascending Spiral Wind Ribbons + Twin Zephyr Wings + Celestial Lyre
        for k in range(3):
            tb.add_torus(0.16 + k * 0.03, 0.015, major_segs=22, minor_segs=8, arc=math.pi * 1.35, twist_z=0.38, taper_end=0.25,
                         mat=2 if k != 1 else 3, loc=(0.0, 0.0, z0 + 0.18 + k * 0.11), rot_euler=(0.0, 0.0, k * 2.1))
        # Twin sculpted zephyr wings
        for sgn in (-1.0, 1.0):
            for f_i in range(4):
                tb.add_box((0.20 - f_i * 0.025, 0.026, 0.048), mat=3,
                           loc=(sgn * (0.14 + f_i * 0.02), 0.02, z0 + 0.34 + f_i * 0.055),
                           rot_euler=(0.15, -sgn * (0.42 + f_i * 0.12), sgn * 0.2), bevel=0.006)
        # Celestial lyre frame at heart of vortex
        tb.add_torus(0.095, 0.016, major_segs=20, minor_segs=8, arc=math.pi * 1.3, mat=4, loc=(0.0, -0.02, z0 + 0.34), rot_euler=(math.pi / 2, 0.0, 0.0))

    elif card_id == "TP-003":
        # Caliban: Volcanic Basalt Fang Crags + Reef Coral Spires + Broken Iron Ring
        crags = [(-0.12, 0.04, 0.34, 0.11, 0.22), (0.11, 0.06, 0.42, 0.12, -0.18), (0.0, -0.07, 0.28, 0.10, 0.10), (-0.04, 0.10, 0.48, 0.13, 0.05)]
        for cx, cy, h, r_b, tilt in crags:
            tb.add_cylinder(r_b, 0.016, h, segs=7, mat=3, loc=(cx, cy, z0 + h * 0.48), rot_euler=(tilt, -tilt * 0.7, 0.4))
        # Branching sea-coral spires
        for k in range(5):
            a = (k / 5.0) * 2.0 * math.pi
            tb.add_torus(0.09, 0.018, major_segs=14, minor_segs=8, arc=math.pi * 0.9, twist_z=0.18, taper_end=0.35, mat=4,
                         loc=(0.10 * math.cos(a), 0.10 * math.sin(a), z0 + 0.24 + k * 0.04), rot_euler=(1.1, 0.3, a))
        # Reclaimed island crystal & broken iron shackle arc
        tb.add_icosphere(0.065, subdivisions=1, mat=2, loc=(0.02, -0.02, z0 + 0.34), scale=(0.8, 0.8, 1.5))
        tb.add_torus(0.11, 0.020, major_segs=18, minor_segs=8, arc=math.pi * 1.45, mat=1, loc=(-0.06, -0.08, z0 + 0.11), rot_euler=(0.7, 0.3, 0.5))

    elif card_id == "MO-003":
        # Benvolio: Round Dawn Buckler Shield + Sheathed Sword + Ascending Peacekeeper Dove
        tb.add_cylinder(0.21, 0.19, 0.038, segs=24, mat=2, loc=(0.0, 0.03, z0 + 0.25), rot_euler=(1.32, 0.0, 0.0))
        tb.add_torus(0.20, 0.018, major_segs=24, minor_segs=8, mat=3, loc=(0.0, 0.02, z0 + 0.25), rot_euler=(1.32, 0.0, 0.0))
        tb.add_sphere(0.055, u_segs=14, v_segs=10, mat=1, loc=(0.0, -0.005, z0 + 0.25), scale=(1.0, 0.5, 1.0))
        # Sheathed sword upright behind shield
        tb.add_cylinder(0.024, 0.014, 0.58, segs=12, mat=1, loc=(0.0, 0.06, z0 + 0.29))
        tb.add_box((0.20, 0.028, 0.026), mat=1, loc=(0.0, 0.06, z0 + 0.50), bevel=0.004)
        # Ascending silver dove & olive branch arc above shield
        tb.add_sphere(0.058, u_segs=14, v_segs=10, mat=3, loc=(0.0, -0.03, z0 + 0.49), scale=(0.85, 1.35, 0.78))
        for sgn in (-1.0, 1.0):
            tb.add_box((0.16, 0.055, 0.014), mat=3, loc=(sgn * 0.10, -0.02, z0 + 0.53), rot_euler=(0.2, -sgn * 0.48, sgn * 0.25), bevel=0.004)
        tb.add_torus(0.14, 0.012, major_segs=18, minor_segs=8, arc=math.pi * 0.85, taper_end=0.3, mat=4, loc=(0.0, -0.06, z0 + 0.36), rot_euler=(1.32, 0.0, 0.2))

    elif card_id == "CA-002":
        # Tybalt: Torch Brazier + Vertical Duelling Blade + Feline Guard + Spiral Flames
        tb.add_lathe([(0.11, 0.0), (0.16, 0.07), (0.19, 0.13), (0.14, 0.14)], segs=18, mat=3, loc=(0.0, 0.0, z0))
        tb.add_cylinder(0.018, 0.004, 0.58, segs=12, mat=3, loc=(0.0, 0.0, z0 + 0.34))
        # Prince of Cats swept feline guard
        tb.add_torus(0.11, 0.018, major_segs=18, minor_segs=8, arc=math.pi, mat=1, loc=(0.0, 0.0, z0 + 0.18), rot_euler=(math.pi / 2, 0.0, 0.0))
        for sgn in (-1.0, 1.0):
            tb.add_cylinder(0.024, 0.003, 0.065, segs=8, mat=2, loc=(sgn * 0.065, -0.02, z0 + 0.22), rot_euler=(0.0, -sgn * 0.25, 0.0))
        # Spiral torch flames wreathing blade
        for k in range(4):
            a = (k / 4.0) * 2.0 * math.pi
            tb.add_torus(0.095, 0.020, major_segs=18, minor_segs=8, arc=math.pi * 1.25, twist_z=0.34, taper_end=0.15,
                         mat=4 if k % 2 == 0 else 2, loc=(0.0, 0.0, z0 + 0.30 + k * 0.04), rot_euler=(0.0, 0.0, a))

    elif card_id == "DC-003":
        # King Claudius: Usurper's Jagged Crown + Coiled Bronze Serpent + Hebona Poison Vial
        tb.add_torus(0.17, 0.026, major_segs=24, minor_segs=10, mat=3, loc=(0.0, 0.0, z0 + 0.12))
        for sp in range(8):
            a = (sp / 8.0) * 2.0 * math.pi
            tb.add_cylinder(0.028, 0.004, 0.11, segs=8, mat=3, loc=(0.17 * math.cos(a), 0.17 * math.sin(a), z0 + 0.19))
        # Coiled serpent rising through the crown
        for turn in range(3):
            tb.add_torus(0.125 - turn * 0.015, 0.024 - turn * 0.003, major_segs=20, minor_segs=10, arc=math.pi * 1.75,
                         twist_z=0.11, mat=2, loc=(0.0, 0.0, z0 + 0.12 + turn * 0.10), rot_euler=(0.0, 0.0, turn * 1.2))
        tb.add_sphere(0.045, u_segs=14, v_segs=10, mat=2, loc=(0.05, -0.06, z0 + 0.41), scale=(1.3, 0.85, 0.72))
        # Tilted black-glass Hebona vial & falling venom drop
        tb.add_lathe([(0.045, 0.0), (0.065, 0.06), (0.022, 0.13), (0.030, 0.16)], segs=16, mat=0, loc=(-0.06, -0.03, z0 + 0.44), rot_euler=(0.0, 2.15, 0.0))
        tb.add_sphere(0.030, u_segs=12, v_segs=10, mat=4, loc=(0.02, -0.03, z0 + 0.29), scale=(0.8, 0.8, 1.45))

    elif card_id == "FA-003":
        # Oberon: Moonlit Silver Stag-Antler Crown + Crescent Moon + Dewdrop Crystal
        tb.add_torus(0.16, 0.020, major_segs=24, minor_segs=8, mat=2, loc=(0.0, 0.0, z0 + 0.08))
        for sgn in (-1.0, 1.0):
            tb.add_torus(0.22, 0.022, major_segs=20, minor_segs=8, arc=math.pi * 0.85, twist_z=0.14, taper_end=0.22, mat=3,
                         loc=(sgn * 0.08, 0.0, z0 + 0.30), rot_euler=(math.pi / 2, -sgn * 0.25, sgn * 0.35))
            for tine in range(3):
                tb.add_cylinder(0.018, 0.003, 0.13, segs=8, mat=3,
                                loc=(sgn * (0.16 + tine * 0.045), -0.01 * tine, z0 + 0.28 + tine * 0.09),
                                rot_euler=(0.12, sgn * (0.35 - tine * 0.12), 0.0))
        # Luminous silver crescent moon & floating violet dewdrop
        tb.add_torus(0.12, 0.022, major_segs=22, minor_segs=10, arc=math.pi * 1.35, taper_end=0.2, mat=3,
                     loc=(0.0, 0.0, z0 + 0.36), rot_euler=(math.pi / 2, 0.0, 0.4))
        tb.add_icosphere(0.052, subdivisions=2, mat=4, loc=(0.0, 0.0, z0 + 0.36), scale=(0.82, 0.82, 1.38))


# ---------------------------------------------------------------------------
# First-Party 3D Gaussian Splat (.ply) Surface Sampler for SM-001
# ---------------------------------------------------------------------------
def export_sm001_splat_ply(obj: bpy.types.Object, mat_colors: list[tuple[float, float, float]], out_ply: Path, count: int = 16384) -> dict:
    """ deterministically samples 16,384 surface splats from our first-party SM-001 mesh so
    `public/models/splats/sm-001.ply` also carries 0% untraced data and 0% human likeness."""
    SH_C0 = 0.28209479177387814
    mesh = obj.data
    mesh.calc_loop_triangles()

    tris = []
    areas = []
    total_area = 0.0
    for tri in mesh.loop_triangles:
        v0 = mesh.vertices[tri.vertices[0]].co.copy()
        v1 = mesh.vertices[tri.vertices[1]].co.copy()
        v2 = mesh.vertices[tri.vertices[2]].co.copy()
        area = ((v1 - v0).cross(v2 - v0)).length * 0.5
        if area <= 1e-9:
            continue
        total_area += area
        tris.append((v0, v1, v2, tri.normal.copy(), tri.material_index))
        areas.append(total_area)

    rng = random.Random(20261124)
    import bisect

    header = (
        "ply\n"
        "format binary_little_endian 1.0\n"
        f"element vertex {count}\n"
        "property float x\n"
        "property float y\n"
        "property float z\n"
        "property float scale_0\n"
        "property float scale_1\n"
        "property float scale_2\n"
        "property float rot_0\n"
        "property float rot_1\n"
        "property float rot_2\n"
        "property float rot_3\n"
        "property float f_dc_0\n"
        "property float f_dc_1\n"
        "property float f_dc_2\n"
        "property float opacity\n"
        "end_header\n"
    ).encode("ascii")

    # Log-scale for crisp disk splats tangent to surface
    log_tangent = math.log(0.011)
    log_normal = math.log(0.0025)
    logit_opacity = 3.2  # sigmoid(3.2) ~= 0.961

    buf = bytearray(header)
    pack_splat = struct.Struct("<14f").pack
    z_axis = Vector((0.0, 0.0, 1.0))

    for _ in range(count):
        pick = rng.random() * total_area
        idx = bisect.bisect_left(areas, pick)
        if idx >= len(tris):
            idx = len(tris) - 1
        v0, v1, v2, nrm, m_idx = tris[idx]
        r1 = math.sqrt(rng.random())
        r2 = rng.random()
        p_bl = v0 * (1.0 - r1) + v1 * (r1 * (1.0 - r2)) + v2 * (r1 * r2)

        # Convert Blender Z-up (x, y, z) -> Babylon/glTF Y-up (x, z, -y) centered at y=0.42
        px, py, pz = p_bl.x, p_bl.z - 0.42, -p_bl.y
        n_yup = Vector((nrm.x, nrm.z, -nrm.y)).normalized()
        q: Quaternion = z_axis.rotation_difference(n_yup)

        base_rgb = mat_colors[m_idx % len(mat_colors)]
        # Subtle warm studio lighting shading on splat DC terms
        shade = 0.82 + 0.26 * max(0.0, n_yup.y * 0.7 + n_yup.x * 0.5 + n_yup.z * 0.5)
        f0 = (min(1.0, base_rgb[0] * shade) - 0.5) / SH_C0
        f1 = (min(1.0, base_rgb[1] * shade) - 0.5) / SH_C0
        f2 = (min(1.0, base_rgb[2] * shade) - 0.5) / SH_C0

        buf.extend(pack_splat(
            px, py, pz,
            log_tangent, log_tangent, log_normal,
            q.w, q.x, q.y, q.z,
            f0, f1, f2,
            logit_opacity,
        ))

    out_ply.parent.mkdir(parents=True, exist_ok=True)
    out_ply.write_bytes(bytes(buf))
    digest = hashlib.sha256(buf).hexdigest()
    return {
        "file": "splats/sm-001.ply",
        "splats": count,
        "bytes": len(buf),
        "sha256": digest,
    }


def verify_glb_binary(glb_path: Path) -> dict:
    """Parse exported glTF 2.0 binary header & JSON chunk to assert triangle primitives (mode 4, NOT points)."""
    data = glb_path.read_bytes()
    if len(data) > 350 * 1024:
        raise RuntimeError(f"{glb_path.name} exceeds 350 KB budget ({len(data)} bytes)")
    magic, version, total_len = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2:
        raise RuntimeError(f"{glb_path.name}: invalid glTF 2.0 header")
    json_len, json_type = struct.unpack_from("<II", data, 12)
    if json_type != 0x4E4F534A:
        raise RuntimeError(f"{glb_path.name}: missing JSON chunk")
    gltf = json.loads(data[20 : 20 + json_len].decode("utf-8"))
    prim_count = 0
    has_normals = False
    has_normal_tex = any("normalTexture" in m for m in gltf.get("materials", []))
    for m in gltf.get("meshes", []):
        for p in m.get("primitives", []):
            mode = p.get("mode", 4)
            if mode == 0:
                raise RuntimeError(f"{glb_path.name}: forbidden mode 0 (POINTS) primitive detected!")
            if mode != 4:
                raise RuntimeError(f"{glb_path.name}: expected mode 4 (TRIANGLES), got {mode}")
            if "NORMAL" in p.get("attributes", {}):
                has_normals = True
            prim_count += 1
    if prim_count == 0 or not has_normals or not has_normal_tex:
        raise RuntimeError(f"{glb_path.name}: missing triangle primitives, normals, or normalTexture")
    return {
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "primitives": prim_count,
        "materials": len(gltf.get("materials", [])),
    }


def main() -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    SPLATS_DIR.mkdir(parents=True, exist_ok=True)
    script_sha256 = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()

    records = []
    splat_record = None

    for spec in CARD_SPECS:
        clear_scene()
        normal_img = load_shared_normal_image()

        # 5 curated PBR materials per trophy
        obsidian_rgb = (0.055, 0.052, 0.068)
        brass_rgb = (0.83, 0.65, 0.24)
        mats = [
            make_pbr_mat(f"{spec['id']}_Obsidian", obsidian_rgb, metallic=0.18, roughness=0.28, normal_img=normal_img, normal_strength=0.22),
            make_pbr_mat(f"{spec['id']}_Brass", brass_rgb, metallic=0.92, roughness=0.24, normal_img=normal_img, normal_strength=0.18),
            make_pbr_mat(f"{spec['id']}_Primary", spec["primary"], metallic=0.55, roughness=0.30, normal_img=normal_img, normal_strength=0.25),
            make_pbr_mat(f"{spec['id']}_Secondary", spec["secondary"], metallic=0.35, roughness=0.36, normal_img=normal_img, normal_strength=0.24),
            make_pbr_mat(
                f"{spec['id']}_Accent",
                spec["accent"],
                metallic=0.72,
                roughness=0.20,
                normal_img=normal_img,
                normal_strength=0.16,
                emissive=spec["emissive"],
                emissive_strength=1.0,
            ),
        ]

        tb = TrophyBuilder(mats)
        tb.add_collector_plinth()
        sculpt_motif(tb, spec["id"])
        obj, mesh_stats = tb.finalize_object(f"{spec['id']}_{spec['name'].replace(' ', '_')}")

        if spec["id"] == "SM-001":
            splat_record = export_sm001_splat_ply(
                obj,
                [obsidian_rgb, brass_rgb, spec["primary"], spec["secondary"], spec["accent"]],
                SPLATS_DIR / "sm-001.ply",
                count=16384,
            )

        out_glb = MODELS_DIR / f"{spec['id'].lower()}.glb"
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj

        bpy.ops.export_scene.gltf(
            filepath=str(out_glb),
            export_format="GLB",
            use_selection=True,
            export_yup=True,
            export_apply=True,
            export_texcoords=True,
            export_normals=True,
            export_tangents=True,
            export_materials="EXPORT",
        )

        glb_meta = verify_glb_binary(out_glb)
        rec = {
            "card_id": spec["id"],
            "name": spec["name"],
            "house": spec["house"],
            "file": out_glb.name,
            "motif": spec["motif"],
            **mesh_stats,
            **glb_meta,
        }
        records.append(rec)
        print(
            f"[forged] {rec['file']:12s} | {rec['bytes'] / 1024:6.1f} KB | "
            f"{rec['triangles']:5d} tris | watertight={rec['watertight']} | sha256={rec['sha256'][:16]}…"
        )

    provenance = {
        "generator": f"Blender {bpy.app.version_string} ({bpy.app.build_date.decode('utf-8', errors='replace')})",
        "script": "scripts/art/forge_ar_trophies_blender.py",
        "script_sha256": script_sha256,
        "license": "First-party procedural 3D work of Voyage Tracable, LLC (DBA Inspired Mile); zero third-party meshes, textures, or AI models.",
        "devon_glover_likeness": "none (SM-001 depicts The Ring Stage Emblem: spotlight ring, vintage brass microphone, and quarto folio per D-13/D-14/R8)",
        "models": records,
        "splats": [splat_record] if splat_record else [],
    }
    prov_path = MODELS_DIR / "provenance.json"
    prov_path.write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8")
    print(f"[provenance] wrote {prov_path} ({len(records)} GLB sculptures + {len(provenance['splats'])} PLY splat)")


if __name__ == "__main__":
    main()
