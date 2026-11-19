import * as THREE from 'three';

/**
 * The look of surfaces, drawn once on a canvas and repeated: marble floor tiles with their veins,
 * parquet, terrazzo, carpet, bathroom tiles, the damask of a bedspread, the quilting of a duvet.
 * Nothing is downloaded. Each texture is made the first time it is asked for and shared after.
 */

const cache = new Map<string, THREE.CanvasTexture>();

function canvas(size: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  return g ? { c, g } : null;
}

/** A small, repeatable random, so a pattern is the same every visit */
function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function texture(key: string, size: number, draw: (g: CanvasRenderingContext2D, size: number) => void): THREE.CanvasTexture | null {
  const hit = cache.get(key);
  if (hit) return hit;
  const made = canvas(size);
  if (!made) return null;
  draw(made.g, size);
  const t = new THREE.CanvasTexture(made.c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  cache.set(key, t);
  return t;
}

/** Marble veins: soft wandering lines, a few strong, many faint, wrapping at the edges so the tile repeats */
function veins(g: CanvasRenderingContext2D, size: number, colour: string, count: number, seed: number, width = 1.2): void {
  const r = random(seed);
  g.save();
  g.lineCap = 'round';
  for (let k = 0; k < count; k++) {
    const strong = k < count / 4;
    g.strokeStyle = colour.replace('ALPHA', String(strong ? 0.55 : 0.2 + r() * 0.15));
    g.lineWidth = (strong ? width * 1.4 : width * 0.6) * (0.6 + r());
    let x = r() * size;
    let y = r() * size;
    let a = r() * Math.PI * 2;
    g.beginPath();
    g.moveTo(x, y);
    const steps = 30 + Math.floor(r() * 30);
    for (let s = 0; s < steps; s++) {
      a += (r() - 0.5) * 0.7;
      const nx = x + Math.cos(a) * size * 0.03;
      const ny = y + Math.sin(a) * size * 0.03;
      g.quadraticCurveTo(x, y, nx, ny);
      x = nx;
      y = ny;
      // Off one edge, on at the other: the vein runs on into the next tile
      if (x < 0 || x > size || y < 0 || y > size) {
        x = (x + size) % size;
        y = (y + size) % size;
        g.stroke();
        g.beginPath();
        g.moveTo(x, y);
      }
    }
    g.stroke();
    // Little branches off the strong ones
    if (strong && r() < 0.7) {
      g.lineWidth *= 0.5;
      g.beginPath();
      g.moveTo(x, y);
      for (let s = 0; s < 8; s++) g.lineTo(x + (r() - 0.5) * size * 0.12, y + (r() - 0.5) * size * 0.12);
      g.stroke();
    }
  }
  g.restore();
}

/** Grout lines round each tile in a `tiles` × `tiles` square */
function grout(g: CanvasRenderingContext2D, size: number, tiles: number, colour: string, width: number): void {
  g.fillStyle = colour;
  const step = size / tiles;
  for (let i = 0; i < tiles; i++) {
    g.fillRect(i * step, 0, width, size);
    g.fillRect(0, i * step, size, width);
  }
}

/** Each tile a shade off its neighbours, and a gleam across it, as polished stone is */
function tileShades(g: CanvasRenderingContext2D, size: number, tiles: number, seed: number, amount: number): void {
  const r = random(seed);
  const step = size / tiles;
  for (let i = 0; i < tiles; i++) {
    for (let j = 0; j < tiles; j++) {
      const v = (r() - 0.5) * amount;
      g.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
      g.fillRect(i * step, j * step, step, step);
      const sheen = g.createLinearGradient(i * step, j * step, (i + 1) * step, (j + 1) * step);
      sheen.addColorStop(0, 'rgba(255,255,255,0.06)');
      sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
      sheen.addColorStop(1, 'rgba(0,0,0,0.04)');
      g.fillStyle = sheen;
      g.fillRect(i * step, j * step, step, step);
    }
  }
}

/** Specks of stone through a base (terrazzo, granite) */
function specks(g: CanvasRenderingContext2D, size: number, colours: string[], count: number, seed: number, big: number): void {
  const r = random(seed);
  for (let k = 0; k < count; k++) {
    g.fillStyle = colours[Math.floor(r() * colours.length)];
    const s = 0.6 + r() * big;
    g.beginPath();
    g.ellipse(r() * size, r() * size, s, s * (0.5 + r() * 0.5), r() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
}

/**
 * A floor, by its finish in the catalogue (FLOOR_STYLES). The texture is the floor's own colour:
 * the material it goes on is left white. One repeat covers `metres` square.
 */
export function floorSurface(style: string): { map: THREE.CanvasTexture | null; metres: number } {
  switch (style) {
    case 'parquet_wood':
      return { metres: 1.6, map: texture('floor parquet', 512, (g, n) => planks(g, n, ['#8a4b1f', '#7a4019', '#955426', '#6f3a15'], 8, 11)) };
    case 'chevron_oak':
      return { metres: 1.4, map: texture('floor chevron', 512, (g, n) => chevron(g, n, ['#4a2310', '#5a2c14', '#3f1d0c', '#532812'])) };
    case 'terrazzo':
      return { metres: 1.2, map: texture('floor terrazzo', 512, (g, n) => {
        g.fillStyle = '#d8d6d0'; g.fillRect(0, 0, n, n);
        specks(g, n, ['#9ca3af', '#6b7280', '#e5e7eb', '#a8a29e', '#57534e', '#f5f5f4', '#b45309'], 2600, 3, 3.5);
        grout(g, n, 2, 'rgba(120,120,120,0.35)', 2);
      }) };
    case 'marble_black':
      return { metres: 1.2, map: texture('floor nero marble', 512, (g, n) => {
        g.fillStyle = '#16181d'; g.fillRect(0, 0, n, n);
        tileShades(g, n, 2, 5, 0.06);
        veins(g, n, 'rgba(235,235,240,ALPHA)', 26, 7, 1.6);
        grout(g, n, 2, 'rgba(0,0,0,0.6)', 2);
      }) };
    case 'calacatta_gold':
      return { metres: 1.2, map: texture('floor calacatta', 512, (g, n) => {
        g.fillStyle = '#f6f4ef'; g.fillRect(0, 0, n, n);
        tileShades(g, n, 2, 9, 0.04);
        veins(g, n, 'rgba(120,118,112,ALPHA)', 22, 13, 1.5);
        veins(g, n, 'rgba(196,160,82,ALPHA)', 8, 17, 1.8);
        grout(g, n, 2, 'rgba(150,150,150,0.75)', 3);
      }) };
    case 'grey_granite':
      return { metres: 1.2, map: texture('floor granite', 512, (g, n) => {
        g.fillStyle = '#6b7280'; g.fillRect(0, 0, n, n);
        specks(g, n, ['#111827', '#d1d5db', '#4b5563', '#9ca3af', '#f3f4f6'], 5000, 19, 1.4);
        tileShades(g, n, 2, 21, 0.05);
        grout(g, n, 2, 'rgba(30,30,30,0.5)', 2);
      }) };
    case 'royal_maroon':
      return { metres: 0.8, map: texture('floor carpet', 256, (g, n) => {
        g.fillStyle = '#7f1d38'; g.fillRect(0, 0, n, n);
        const r = random(23);
        for (let k = 0; k < 9000; k++) {
          g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
          g.fillRect(r() * n, r() * n, 1, 1 + r() * 2);
        }
      }) };
    case 'ceramic_white':
    default:
      // Big white tiles with faint grey veins: the polished floor of a good Lagos home
      return { metres: 1.2, map: texture('floor white tiles', 512, (g, n) => {
        g.fillStyle = '#f3f2ee'; g.fillRect(0, 0, n, n);
        tileShades(g, n, 2, 29, 0.05);
        veins(g, n, 'rgba(120,120,128,ALPHA)', 22, 31, 1.6);
        grout(g, n, 2, 'rgba(140,140,148,0.85)', 3.5);
      }) };
  }
}

/** Small square tiles for a bathroom or a kitchen: `tint` the tile colour */
export function smallTiles(tint: string): THREE.CanvasTexture | null {
  return texture(`small tiles ${tint}`, 256, (g, n) => {
    g.fillStyle = tint; g.fillRect(0, 0, n, n);
    tileShades(g, n, 4, 37, 0.05);
    veins(g, n, 'rgba(140,150,160,ALPHA)', 6, 41, 0.8);
    grout(g, n, 4, 'rgba(110,120,130,0.75)', 3);
  });
}

function planks(g: CanvasRenderingContext2D, n: number, tones: string[], rows: number, seed: number): void {
  const r = random(seed);
  const h = n / rows;
  for (let row = 0; row < rows; row++) {
    let x = -r() * n * 0.5;
    while (x < n) {
      const len = n * (0.35 + r() * 0.4);
      g.fillStyle = tones[Math.floor(r() * tones.length)];
      g.fillRect(x, row * h, len, h);
      // The grain along the plank
      for (let k = 0; k < 14; k++) {
        g.strokeStyle = `rgba(0,0,0,${0.05 + r() * 0.08})`;
        g.lineWidth = 0.6 + r();
        const y = row * h + r() * h;
        g.beginPath();
        g.moveTo(x, y);
        g.bezierCurveTo(x + len * 0.3, y + (r() - 0.5) * 4, x + len * 0.6, y + (r() - 0.5) * 4, x + len, y);
        g.stroke();
      }
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(x, row * h, 1.5, h);
      x += len;
    }
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(0, row * h, n, 1.5);
  }
}

function chevron(g: CanvasRenderingContext2D, n: number, tones: string[]): void {
  const r = random(43);
  const w = n / 4;
  g.fillStyle = tones[0];
  g.fillRect(0, 0, n, n);
  for (let col = 0; col < 4; col++) {
    for (let k = -2; k < 10; k++) {
      const y = k * (n / 8);
      g.fillStyle = tones[Math.floor(r() * tones.length)];
      g.beginPath();
      const x0 = col * w;
      g.moveTo(x0, y);
      g.lineTo(x0 + w / 2, y + w / 2);
      g.lineTo(x0 + w, y);
      g.lineTo(x0 + w, y + n / 8);
      g.lineTo(x0 + w / 2, y + w / 2 + n / 8);
      g.lineTo(x0, y + n / 8);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = 1.2;
      g.stroke();
    }
  }
}

/**
 * Cloth for a bed or a sofa, drawn white so the material's colour dyes it: `damask` (a woven
 * flower pattern, as on a good bedspread), `quilt` (stitched diamonds), `weave` (plain cloth).
 */
export function fabric(kind: 'damask' | 'quilt' | 'weave'): THREE.CanvasTexture | null {
  return texture(`fabric ${kind}`, 256, (g, n) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, n, n);
    // The weave everywhere
    const r = random(kind.length * 7);
    for (let k = 0; k < 5000; k++) {
      g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.035)' : 'rgba(255,255,255,0.4)';
      g.fillRect(r() * n, r() * n, 1 + r() * 2, 1);
    }
    if (kind === 'damask') {
      g.strokeStyle = 'rgba(0,0,0,0.16)';
      g.fillStyle = 'rgba(0,0,0,0.09)';
      g.lineWidth = 2;
      const motif = (cx: number, cy: number, s: number) => {
        g.beginPath();
        for (let a = 0; a < 4; a++) {
          const t = (a * Math.PI) / 2;
          g.ellipse(cx + Math.cos(t) * s * 0.42, cy + Math.sin(t) * s * 0.42, s * 0.36, s * 0.16, t, 0, Math.PI * 2);
        }
        g.fill();
        g.beginPath();
        g.arc(cx, cy, s * 0.14, 0, Math.PI * 2);
        g.stroke();
        for (const sx of [-1, 1]) {
          g.beginPath();
          g.moveTo(cx, cy - s * 0.95);
          g.quadraticCurveTo(cx + sx * s * 0.8, cy, cx, cy + s * 0.95);
          g.stroke();
        }
      };
      const s = n / 4;
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) motif(n / 4 + i * (n / 2), n / 4 + j * (n / 2), s);
      // The offset row, so it repeats as a woven pattern does
      for (const [x, y] of [[0, 0], [n, 0], [0, n], [n, n], [n / 2, n / 2]]) motif(x, y, s * 0.7);
    } else if (kind === 'quilt') {
      g.strokeStyle = 'rgba(0,0,0,0.14)';
      g.lineWidth = 2;
      g.setLineDash([5, 4]);
      for (let k = -n; k < n * 2; k += n / 4) {
        g.beginPath(); g.moveTo(k, 0); g.lineTo(k + n, n); g.stroke();
        g.beginPath(); g.moveTo(k + n, 0); g.lineTo(k, n); g.stroke();
      }
      g.setLineDash([]);
    }
  });
}

/** Wood: long grain lines, for a headboard, a door or a cabinet, drawn white to be dyed */
export function woodGrain(): THREE.CanvasTexture | null {
  return texture('wood grain', 256, (g, n) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, n, n);
    const r = random(53);
    for (let k = 0; k < 70; k++) {
      g.strokeStyle = `rgba(0,0,0,${0.04 + r() * 0.1})`;
      g.lineWidth = 0.5 + r() * 1.8;
      const x = r() * n;
      g.beginPath();
      g.moveTo(x, 0);
      g.bezierCurveTo(x + (r() - 0.5) * 18, n * 0.33, x + (r() - 0.5) * 18, n * 0.66, x, n);
      g.stroke();
    }
  });
}

/** A soft cone of light thrown down a wall by a ceiling downlight: bright at the top, gone at the bottom */
export function lightPool(): THREE.CanvasTexture | null {
  return texture('light pool soft', 128, (g, n) => {
    // Worked out a pixel at a time: brightest just under the lamp, widening as it falls, soft at every edge
    const image = g.createImageData(n, n);
    for (let y = 0; y < n; y++) {
      const t = y / n;
      const half = n * (0.06 + t * 0.4);
      const fall = Math.pow(1 - t, 1.6) * (t < 0.04 ? t / 0.04 : 1);
      for (let x = 0; x < n; x++) {
        const across = (x - n / 2) / half;
        const a = Math.exp(-across * across * 1.6) * fall;
        const k = (y * n + x) * 4;
        image.data[k] = 255;
        image.data[k + 1] = 226 - t * 30;
        image.data[k + 2] = 170 - t * 50;
        image.data[k + 3] = Math.round(Math.min(1, a) * 235);
      }
    }
    g.putImageData(image, 0, 0);
  });
}

/** A texture of this kind, repeated `x` by `y` times (its own copy, sharing the picture) */
export function repeated(base: THREE.Texture | null, x: number, y: number): THREE.Texture | null {
  if (!base) return null;
  const t = base.clone();
  t.repeat.set(x, y);
  t.needsUpdate = true;
  return t;
}
