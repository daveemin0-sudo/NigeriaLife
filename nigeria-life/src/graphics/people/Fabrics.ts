import * as THREE from 'three';

/**
 * The cloth the clothes are cut from, drawn once and kept: plain cotton with its weave, denim,
 * ankara wax print, aso-oke stripes, a shirt's check, a football jersey's stripes, lace. Each is
 * a small repeating canvas so a garment reads as cloth up close and costs little.
 */

export type Pattern = 'plain' | 'denim' | 'ankara' | 'aso_oke' | 'check' | 'stripes' | 'lace' | 'leather' | 'knit';

const cache = new Map<string, THREE.Texture>();

const hex = (n: number) => `#${(n & 0xffffff).toString(16).padStart(6, '0')}`;
const shade = (n: number, k: number) => {
  const c = new THREE.Color(n);
  if (k >= 0) c.lerp(new THREE.Color(0xffffff), k);
  else c.lerp(new THREE.Color(0x000000), -k);
  return `#${c.getHexString()}`;
};

/** A seeded little random, so the same cloth is drawn the same every time */
function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function fabric(pattern: Pattern, base: number, accent = 0xffffff, third = 0x111827): THREE.Texture | null {
  if (pattern === 'plain' || typeof document === 'undefined') return weave(base);
  const key = `${pattern}:${base}:${accent}:${third}`;
  const known = cache.get(key);
  if (known) return known;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seeded(base ^ (accent << 3) ^ pattern.length);
  ctx.fillStyle = hex(base);
  ctx.fillRect(0, 0, size, size);
  let repeat: [number, number] = [2, 2];

  if (pattern === 'denim') {
    // Twill: fine diagonal lines, lighter threads, a little fading
    for (let i = -size; i < size * 2; i += 3) {
      ctx.strokeStyle = rand() < 0.5 ? shade(base, 0.18) : shade(base, -0.12);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + size, size);
      ctx.stroke();
    }
    for (let i = 0; i < 600; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.04 + rand() * 0.06})`;
      ctx.fillRect(rand() * size, rand() * size, 1 + rand() * 3, 1);
    }
    repeat = [3, 3];
  } else if (pattern === 'ankara') {
    // Wax print: big bold rings and leaves on a ground colour, outlined dark, two colours each
    const motifs = 7;
    for (let m = 0; m < motifs; m++) {
      const x = rand() * size;
      const y = rand() * size;
      const r = 22 + rand() * 26;
      for (const [dx, dy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
        const cx = x + dx;
        const cy = y + dy;
        ctx.fillStyle = hex(third);
        ctx.beginPath();
        ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hex(accent);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hex(base);
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hex(third);
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2);
        ctx.fill();
        // Petals round the ring
        ctx.fillStyle = hex(accent);
        for (let p = 0; p < 8; p++) {
          const a = (p / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.ellipse(cx + Math.cos(a) * r * 0.46, cy + Math.sin(a) * r * 0.46, r * 0.09, r * 0.04, a, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // Small dots between
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = rand() < 0.5 ? hex(accent) : hex(third);
      ctx.beginPath();
      ctx.arc(rand() * size, rand() * size, 2 + rand() * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    repeat = [2, 2];
  } else if (pattern === 'aso_oke') {
    // Hand-woven strips: bands of colour across, fine threads, a shimmer line
    // The strips run up and down the garment, as they are sewn
    let x = 0;
    let k = 0;
    const bands = [18, 4, 26, 3, 10, 5];
    while (x < size) {
      const w = bands[k % bands.length];
      ctx.fillStyle = k % 3 === 0 ? hex(base) : k % 3 === 1 ? hex(accent) : shade(base, -0.22);
      ctx.fillRect(x, 0, w, size);
      x += w;
      k++;
    }
    for (let y = 0; y < size; y += 2) {
      ctx.fillStyle = `rgba(0,0,0,${0.04 + rand() * 0.06})`;
      ctx.fillRect(0, y, size, 1);
    }
    repeat = [4, 2];
  } else if (pattern === 'check') {
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < size; i += 32) {
      ctx.fillStyle = hex(accent);
      ctx.fillRect(i, 0, 12, size);
      ctx.fillRect(0, i, size, 12);
      ctx.fillStyle = hex(third);
      ctx.fillRect(i + 18, 0, 3, size);
      ctx.fillRect(0, i + 18, size, 3);
    }
    ctx.globalAlpha = 1;
    repeat = [3, 3];
  } else if (pattern === 'stripes') {
    for (let i = 0; i < size; i += 32) {
      ctx.fillStyle = hex(accent);
      ctx.fillRect(i, 0, 14, size);
    }
    repeat = [2, 1];
  } else if (pattern === 'lace') {
    // Lace: little flowers of holes, the cloth's own colour lighter round them
    for (let y = 8; y < size; y += 22) {
      for (let x = (y / 22) % 2 ? 8 : 19; x < size; x += 22) {
        ctx.strokeStyle = shade(base, 0.35);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = shade(base, -0.35);
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    repeat = [3, 3];
  } else if (pattern === 'leather') {
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.05 + rand() * 0.08})`;
      ctx.beginPath();
      ctx.arc(rand() * size, rand() * size, 0.6 + rand() * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    repeat = [2, 2];
  } else if (pattern === 'knit') {
    for (let y = 0; y < size; y += 6) {
      for (let x = 0; x < size; x += 8) {
        ctx.strokeStyle = shade(base, (y / 6) % 2 ? 0.12 : -0.12);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 4, y + 6);
        ctx.lineTo(x + 8, y);
        ctx.stroke();
      }
    }
    repeat = [4, 4];
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.anisotropy = 4;
  cache.set(key, texture);
  return texture;
}

/** Plain cloth: its weave, a fine grain over the colour */
function weave(base: number): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const key = `weave:${base}`;
  const known = cache.get(key);
  if (known) return known;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = hex(base);
  ctx.fillRect(0, 0, size, size);
  const rand = seeded(base + 7);
  for (let y = 0; y < size; y += 2) {
    ctx.fillStyle = `rgba(0,0,0,${0.035 + rand() * 0.03})`;
    ctx.fillRect(0, y, size, 1);
  }
  for (let x = 0; x < size; x += 2) {
    ctx.fillStyle = `rgba(255,255,255,${0.025 + rand() * 0.02})`;
    ctx.fillRect(x, 0, 1, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  cache.set(key, texture);
  return texture;
}

/** Hair seen close: fine strands or the grain of a low cut, as a texture over its colour */
export function hairGrain(color: number, kind: 'short' | 'coily' | 'waves' | 'straight'): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const key = `hair:${kind}:${color}`;
  const known = cache.get(key);
  if (known) return known;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seeded(color + kind.length * 31);
  ctx.fillStyle = hex(color);
  ctx.fillRect(0, 0, size, size);
  if (kind === 'waves') {
    for (let y = 0; y < size; y += 7) {
      ctx.strokeStyle = shade(color, 0.22);
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= size; x += 4) ctx.lineTo(x, y + Math.sin((x / size) * Math.PI * 4) * 2.5);
      ctx.stroke();
    }
  } else if (kind === 'straight') {
    for (let i = 0; i < 260; i++) {
      ctx.strokeStyle = rand() < 0.5 ? shade(color, 0.18) : shade(color, -0.2);
      ctx.lineWidth = 1;
      const x = rand() * size;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + (rand() - 0.5) * 6, size);
      ctx.stroke();
    }
  } else {
    // Short or coily: tiny curls and specks
    const n = kind === 'coily' ? 900 : 1400;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = rand() < 0.5 ? shade(color, 0.16) : shade(color, -0.3);
      ctx.beginPath();
      ctx.arc(rand() * size, rand() * size, kind === 'coily' ? 1 + rand() * 1.6 : 0.5 + rand() * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  cache.set(key, texture);
  return texture;
}
