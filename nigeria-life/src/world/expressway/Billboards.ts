import * as THREE from 'three';

/**
 * Every advertising face on the expressway's unipoles, by name, so an advert can be painted on
 * one and taken off again. The expressway registers each face as it builds it.
 */

export interface BoardFace {
  /** `board-<metres along the road>-<a|b>` (see `business/adPrices.ts`) */
  id: string;
  /** Where it stands, in the city */
  x: number;
  z: number;
  /** Turned to the traffic (a) or the face behind (b) */
  face: 'a' | 'b';
  mesh: THREE.Mesh;
  /** The advert it carries when nobody has rented it */
  base: THREE.Texture;
  /** What it shows when nobody has rented it, in words */
  house: string;
}

export interface Advert {
  headline: string;
  line: string;
  colour: string;
  /** Who put it up */
  by: string;
}

const faces = new Map<string, BoardFace>();
const painted = new Map<string, { key: string; texture: THREE.CanvasTexture }>();

function draw(ad: Advert): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  g.addColorStop(0, ad.colour);
  g.addColorStop(1, shade(ad.colour, -0.35));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // A gold rule and a soft light across the top, as a printed board has
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.ellipse(canvas.width * 0.2, -40, canvas.width * 0.6, 120, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8c766';
  ctx.fillRect(28, canvas.height - 46, 120, 6);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '900 76px Outfit Variable, Arial, sans-serif';
  ctx.fillText(ad.headline.toUpperCase(), 28, 92, canvas.width - 56);
  ctx.font = '600 34px Outfit Variable, Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText(ad.line, 28, 162, canvas.width - 56);
  ctx.font = '700 22px Outfit Variable, Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.textAlign = 'right';
  ctx.fillText(ad.by ? `@${ad.by} · Eko Ads` : 'Eko Ads', canvas.width - 28, canvas.height - 40);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function shade(hex: string, by: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v + (by < 0 ? v * by : (255 - v) * by))));
  return `rgb(${ch((n >> 16) & 255)}, ${ch((n >> 8) & 255)}, ${ch(n & 255)})`;
}

export const Billboards = {
  register(face: BoardFace): void {
    faces.set(face.id, face);
  },

  all(): BoardFace[] {
    return [...faces.values()].sort((a, b) => a.z - b.z || a.face.localeCompare(b.face));
  },

  get(id: string): BoardFace | null {
    return faces.get(id) ?? null;
  },

  /** Puts an advert on a board, or the house advert back when `ad` is null */
  paint(id: string, ad: Advert | null): void {
    const face = faces.get(id);
    if (!face) return;
    const material = face.mesh.material as THREE.MeshBasicMaterial;
    const was = painted.get(id);
    if (!ad) {
      if (was) {
        material.map = face.base;
        was.texture.dispose();
        painted.delete(id);
      }
      return;
    }
    const key = `${ad.headline}|${ad.line}|${ad.colour}|${ad.by}`;
    if (was?.key === key) return;
    const texture = draw(ad);
    material.map = texture;
    was?.texture.dispose();
    painted.set(id, { key, texture });
  },

  /** What a board is showing now: the rented advert's headline, or null for its house advert */
  showing(id: string): string | null {
    return painted.get(id)?.key.split('|')[0] ?? null;
  },
};
