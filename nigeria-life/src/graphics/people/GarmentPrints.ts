import * as THREE from 'three';
import type { LogoShape } from '../../player/ClothingStyle';

/**
 * Prints on cloth: our own graphic designs and the player's logo, drawn once on a small canvas in the
 * print's colours and kept (the same print, the same texture). A few are kept at a time; the oldest is let
 * go when more are made, so editing a logo letter by letter cannot pile up textures on the GPU.
 */
const SIZE = 256;
const KEEP = 12;
const prints = new Map<string, THREE.CanvasTexture>();

/** Nothing printed: a clear pixel, shared by every garment without a print */
let blank: THREE.DataTexture | null = null;
export function noPrint(): THREE.Texture {
  if (!blank) {
    blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, THREE.RGBAFormat);
    blank.needsUpdate = true;
  }
  return blank;
}

/** Soft blotches for camouflage and the like: one small tileable noise, shared by every garment */
let noise: THREE.DataTexture | null = null;
export function patternNoise(): THREE.Texture {
  if (noise) return noise;
  const N = 128;
  let seed = 4242;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // Value noise at three sizes, each tileable (its lattice wraps)
  const layer = (cells: number) => {
    const g = Array.from({ length: cells * cells }, rnd);
    const at = (x: number, y: number) => g[((y % cells) + cells) % cells * cells + (((x % cells) + cells) % cells)];
    return (u: number, v: number) => {
      const x = u * cells, y = v * cells;
      const x0 = Math.floor(x), y0 = Math.floor(y);
      const fx = x - x0, fy = y - y0;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
      const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
      return a + (b - a) * sy;
    };
  };
  const big = layer(4), mid = layer(8), small = layer(16), other = layer(6), fine = layer(32);
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = x / N, v = y / N;
      const i = (y * N + x) * 4;
      data[i] = Math.round((big(u, v) * 0.6 + mid(u, v) * 0.3 + small(u, v) * 0.1) * 255);
      data[i + 1] = Math.round((other(u, v) * 0.6 + small(u + 0.3, v) * 0.4) * 255);
      data[i + 2] = Math.round(fine(u, v) * 255);
      data[i + 3] = 255;
    }
  }
  noise = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  noise.wrapS = noise.wrapT = THREE.RepeatWrapping;
  noise.magFilter = THREE.LinearFilter;
  noise.minFilter = THREE.LinearMipmapLinearFilter;
  noise.generateMipmaps = true;
  noise.needsUpdate = true;
  return noise;
}

function keep(key: string, draw: (c: CanvasRenderingContext2D) => void): THREE.Texture {
  const hit = prints.get(key);
  if (hit) {
    // Most recently used last
    prints.delete(key);
    prints.set(key, hit);
    return hit;
  }
  if (typeof document === 'undefined') return noPrint();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const c = canvas.getContext('2d');
  if (!c) return noPrint();
  draw(c);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  prints.set(key, tex);
  while (prints.size > KEEP) {
    const [oldKey, old] = prints.entries().next().value as [string, THREE.CanvasTexture];
    prints.delete(oldKey);
    // (if a garment still shows it, the renderer uploads it again when drawn)
    old.dispose();
  }
  return tex;
}

/** How many prints are held now (for the tests) */
export function printsHeld(): number {
  return prints.size;
}

// ------------------------------------------------------------------------------------- The designs
const S = SIZE;
function star(c: CanvasRenderingContext2D, x: number, y: number, r: number, points = 5, inner = 0.45): void {
  c.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const rr = i % 2 ? r * inner : r;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
}

const DESIGNS: Record<string, (c: CanvasRenderingContext2D, ink: string, ink2: string) => void> = {
  // A sun rising over the lagoon, with EKO under it
  eko_sun: (c, ink, ink2) => {
    c.fillStyle = ink2;
    c.beginPath(); c.arc(S / 2, 120, 62, Math.PI, 0); c.fill();
    c.strokeStyle = ink2; c.lineWidth = 7;
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + (i + 0.5) * (Math.PI / 9);
      c.beginPath(); c.moveTo(S / 2 + Math.cos(a) * 74, 120 + Math.sin(a) * 74); c.lineTo(S / 2 + Math.cos(a) * 98, 120 + Math.sin(a) * 98); c.stroke();
    }
    c.strokeStyle = ink; c.lineWidth = 8;
    for (let k = 0; k < 3; k++) {
      c.beginPath();
      for (let x = 40; x <= S - 40; x += 4) c.lineTo(x, 134 + k * 16 + Math.sin(x / 14 + k) * 4);
      c.stroke();
    }
    c.fillStyle = ink; c.font = '900 56px Arial Black, Arial, sans-serif'; c.textAlign = 'center';
    c.fillText('EKO', S / 2, 236);
  },
  // LAGOS over a big 234
  lagos_234: (c, ink, ink2) => {
    c.fillStyle = ink; c.textAlign = 'center';
    c.font = '900 50px Arial Black, Arial, sans-serif'; c.fillText('LAGOS', S / 2, 86);
    c.fillStyle = ink2; c.font = '900 112px Arial Black, Arial, sans-serif'; c.fillText('234', S / 2, 204);
    c.fillStyle = ink; c.fillRect(48, 218, S - 96, 8);
  },
  // A palm tree in a ring
  palm: (c, ink, ink2) => {
    c.strokeStyle = ink; c.lineWidth = 10;
    c.beginPath(); c.arc(S / 2, S / 2, 104, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 12; c.lineCap = 'round';
    c.beginPath(); c.moveTo(S / 2 + 8, 210); c.quadraticCurveTo(S / 2 - 14, 150, S / 2 + 4, 96); c.stroke();
    c.fillStyle = ink2;
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.55;
      c.save(); c.translate(S / 2 + 4, 96); c.rotate(a);
      c.beginPath(); c.ellipse(0, -42, 14, 44, 0, 0, Math.PI * 2); c.fill();
      c.restore();
    }
  },
  // A yellow commuter bus, side on, with its stripe
  danfo: (c, ink, ink2) => {
    c.fillStyle = ink2;
    c.beginPath(); c.roundRect(30, 80, 196, 96, 18); c.fill();
    c.fillStyle = ink; c.fillRect(30, 140, 196, 12);
    c.fillStyle = '#e5eef5';
    for (let i = 0; i < 4; i++) c.fillRect(46 + i * 42, 94, 34, 34);
    c.fillStyle = ink;
    for (const x of [70, 186]) { c.beginPath(); c.arc(x, 180, 20, 0, Math.PI * 2); c.fill(); }
    c.font = '900 30px Arial Black, Arial, sans-serif'; c.textAlign = 'center'; c.fillText('OSHODI', S / 2, 236);
  },
  // An adire-style resist pattern: circles of dots and lines in a square
  adire: (c, ink, ink2) => {
    c.fillStyle = ink; c.fillRect(28, 28, 200, 200);
    c.fillStyle = ink2; c.strokeStyle = ink2; c.lineWidth = 5;
    for (let gy = 0; gy < 2; gy++) {
      for (let gx = 0; gx < 2; gx++) {
        const cx = 78 + gx * 100, cy = 78 + gy * 100;
        c.beginPath(); c.arc(cx, cy, 34, 0, Math.PI * 2); c.stroke();
        for (let i = 0; i < 12; i++) { const a = (i * Math.PI) / 6; c.beginPath(); c.arc(cx + Math.cos(a) * 22, cy + Math.sin(a) * 22, 4, 0, Math.PI * 2); c.fill(); }
        c.beginPath(); c.arc(cx, cy, 8, 0, Math.PI * 2); c.fill();
      }
    }
  },
  // The long bridge over the lagoon, its piers and lamp posts
  bridge: (c, ink, ink2) => {
    c.strokeStyle = ink; c.lineWidth = 9;
    c.beginPath(); c.moveTo(20, 120); c.quadraticCurveTo(S / 2, 96, S - 20, 120); c.stroke();
    c.lineWidth = 6;
    for (let x = 36; x < S - 20; x += 28) { c.beginPath(); c.moveTo(x, 118 - Math.sin((x / S) * Math.PI) * 12); c.lineTo(x, 172); c.stroke(); }
    c.strokeStyle = ink2; c.lineWidth = 5;
    for (let k = 0; k < 3; k++) { c.beginPath(); for (let x = 20; x <= S - 20; x += 4) c.lineTo(x, 184 + k * 12 + Math.sin(x / 10 + k * 2) * 3); c.stroke(); }
    c.fillStyle = ink; c.font = '800 26px Arial, sans-serif'; c.textAlign = 'center'; c.fillText('THIRD MAINLAND', S / 2, 72);
  },
};

/** A graphic print in two inks */
export function graphicPrint(design: string, ink: string, ink2: string): THREE.Texture {
  const draw = DESIGNS[design] ?? DESIGNS.eko_sun;
  return keep(`g|${design}|${ink}|${ink2}`, (c) => draw(c, ink, ink2));
}

/** The player's logo: their letters, in a shape or on their own */
export function logoPrint(text: string, shape: LogoShape, ink: string, ink2: string): THREE.Texture {
  return keep(`l|${text}|${shape}|${ink}|${ink2}`, (c) => {
    c.lineJoin = 'round';
    const cx = S / 2, cy = S / 2;
    if (shape === 'circle') { c.fillStyle = ink2; c.beginPath(); c.arc(cx, cy, 116, 0, Math.PI * 2); c.fill(); }
    else if (shape === 'shield') {
      c.fillStyle = ink2; c.beginPath(); c.moveTo(cx - 100, 30); c.lineTo(cx + 100, 30); c.lineTo(cx + 100, 130);
      c.quadraticCurveTo(cx + 96, 206, cx, 238); c.quadraticCurveTo(cx - 96, 206, cx - 100, 130); c.closePath(); c.fill();
    } else if (shape === 'star') { c.fillStyle = ink2; star(c, cx, cy + 8, 124, 5, 0.52); c.fill(); }
    else if (shape === 'badge') { c.fillStyle = ink2; star(c, cx, cy, 120, 16, 0.86); c.fill(); }
    const words = (text || 'NL').toUpperCase();
    const room = shape === 'none' ? 236 : shape === 'star' ? 120 : 170;
    let px = 96;
    c.font = `900 ${px}px Arial Black, Arial, sans-serif`;
    while (px > 18 && c.measureText(words).width > room) { px -= 4; c.font = `900 ${px}px Arial Black, Arial, sans-serif`; }
    c.fillStyle = ink; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(words, cx, cy + (shape === 'shield' ? -6 : shape === 'star' ? 10 : 0));
  });
}
