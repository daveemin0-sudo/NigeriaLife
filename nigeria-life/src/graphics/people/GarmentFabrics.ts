import * as THREE from 'three';
import { graphicPrint, logoPrint, noPrint, patternNoise } from './GarmentPrints';
import type { PatternStyle } from '../../player/ClothingStyle';

/**
 * Cloth that looks like cloth. Each fabric has its own weave, made once as a small tileable texture (the
 * height of the threads, and how their colour varies): cotton jersey's knitted loops, piqué's waffle, an
 * oxford's basket weave, denim's diagonal twill with its white weft showing, cotton twill, rib-knit, fleece,
 * canvas, leather's grain, rubber. On a garment the weave is laid on by where each point of the cloth is
 * on the body at rest, from three sides, so it follows the garment as it moves, at the same size on every
 * garment, with no seams where the body's own texture islands meet. The threads catch the light (the
 * surface is bumped by them), fading out with distance so nothing shimmers.
 *
 * Over the weave: topstitching along each hem (double rows of stitches), along a sleeve's end, down the
 * outside of each trouser leg (a seam with its stitching beside it), and denim's natural fading on the
 * thighs. Every look is set by a FabricLook: the fabric, its colour, the thread colour, how worn it is.
 * Patterns (stripes, pinstripe, check, camouflage, Ankara), a chest print (a graphic or the player's logo) and
 * the cloth's condition (worn, dirty, damaged) are drawn by the same program from uniforms, so a change of
 * look never compiles a new shader and never needs a new garment model.
 */
export type FabricKind = 'jersey' | 'pique' | 'oxford' | 'denim' | 'twill' | 'rib' | 'fleece' | 'canvas' | 'leather' | 'rubber' | 'cotton';

export interface FabricLook {
  kind: FabricKind;
  colour: THREE.Color;
  /** Thread colour for topstitching (denim's gold by default; a shade of the cloth otherwise) */
  stitch?: THREE.Color;
  /** How worn: 0 new, 1 faded and grubby (denim fades on the thighs at any wear) */
  wear?: number;
  /** Dirt (0..1, grime gathered low, at the knees and cuffs) and damage (0..1, thin rubbed spots, frayed hems) */
  dirt?: number;
  damage?: number;
  /** A pattern or print over the cloth (its colours as '#rrggbb'); plain when not set */
  pattern?: PatternStyle;
}

/** Pattern ids as the shader knows them */
const PATTERN_ID: Record<string, number> = { plain: 0, stripes: 1, pinstripe: 2, check: 3, camo: 4, ankara: 5, graphic: 6, logo: 7 };

interface Spec {
  /** Metres per tile of the weave */
  tile: number;
  /** How much the threads stand up (bump) */
  bump: number;
  /** How much the thread colour varies */
  vary: number;
  roughness: number;
  sheen: number;
  /** Hems topstitched, side seams, denim fading */
  stitches: boolean;
  seams: boolean;
  fade: boolean;
}

const SPECS: Record<FabricKind, Spec> = {
  jersey: { tile: 0.05, bump: 1.0, vary: 0.22, roughness: 0.9, sheen: 0.3, stitches: true, seams: false, fade: false },
  pique: { tile: 0.045, bump: 1.4, vary: 0.18, roughness: 0.88, sheen: 0.2, stitches: true, seams: false, fade: false },
  oxford: { tile: 0.04, bump: 0.9, vary: 0.42, roughness: 0.78, sheen: 0.25, stitches: true, seams: false, fade: false },
  denim: { tile: 0.065, bump: 1.2, vary: 0.65, roughness: 0.92, sheen: 0.12, stitches: true, seams: true, fade: true },
  twill: { tile: 0.05, bump: 0.8, vary: 0.2, roughness: 0.88, sheen: 0.18, stitches: true, seams: true, fade: false },
  rib: { tile: 0.06, bump: 1.6, vary: 0.2, roughness: 0.92, sheen: 0.25, stitches: false, seams: false, fade: false },
  fleece: { tile: 0.12, bump: 0.35, vary: 0.25, roughness: 0.97, sheen: 0.45, stitches: true, seams: false, fade: false },
  canvas: { tile: 0.035, bump: 1.0, vary: 0.25, roughness: 0.85, sheen: 0.1, stitches: false, seams: false, fade: false },
  leather: { tile: 0.05, bump: 0.25, vary: 0.15, roughness: 0.38, sheen: 0.0, stitches: false, seams: false, fade: false },
  rubber: { tile: 0.04, bump: 0.15, vary: 0.08, roughness: 0.7, sheen: 0.0, stitches: false, seams: false, fade: false },
  cotton: { tile: 0.045, bump: 0.8, vary: 0.2, roughness: 0.88, sheen: 0.2, stitches: true, seams: false, fade: false },
};

/** The weave of each fabric: R the threads' height, G how their colour varies (both 0..1), tileable */
const weaves = new Map<FabricKind, THREE.DataTexture>();
function weave(kind: FabricKind): THREE.DataTexture {
  const hit = weaves.get(kind);
  if (hit) return hit;
  const N = 256;
  const data = new Uint8Array(N * N * 4);
  let seed = 1 + kind.length * 977;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const noise = new Float32Array(N * N).map(() => rnd());
  const at = (x: number, y: number) => noise[((y + N) % N) * N + ((x + N) % N)];
  const smooth = (x: number, y: number, r: number) => { let s = 0; for (let k = -r; k <= r; k++) s += at(x + k, y) + at(x, y + k); return s / (4 * r + 2); };
  const tau = Math.PI * 2;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = x / N, v = y / N;
      let h = 0.5, g = 0.5;
      switch (kind) {
        case 'jersey': {
          // Knitted loops: columns of little Vs
          const col = (u * 32) % 1, row = (v * 40 + Math.abs(col - 0.5)) % 1;
          h = 0.5 + 0.5 * Math.cos(tau * row) * Math.sin(Math.PI * col);
          g = 0.5 + (smooth(x, y, 2) - 0.5) * 0.9;
          break;
        }
        case 'pique': {
          // A raised waffle of small cells
          const cu = Math.sin(Math.PI * ((u * 36) % 1)), cv = Math.sin(Math.PI * ((v * 36) % 1));
          h = Math.min(1, (cu * cv) ** 0.6);
          g = 0.5 + (at(x, y) - 0.5) * 0.4;
          break;
        }
        case 'oxford': {
          // Basket weave: pairs of threads over and under, a white weft across a coloured warp
          const bu = Math.floor(u * 24), bv = Math.floor(v * 24);
          const across = (bu + bv) % 2 === 0;
          const thread = across ? Math.sin(Math.PI * ((v * 96) % 1)) : Math.sin(Math.PI * ((u * 96) % 1));
          h = 0.35 + 0.65 * thread;
          g = across ? 0.85 : 0.35;
          break;
        }
        case 'denim': {
          // Diagonal twill: indigo warp ridges running up to the left, white weft showing between them
          const d = (u * 48 + v * 48) % 1;
          const ridge = Math.sin(Math.PI * d);
          h = 0.3 + 0.7 * ridge;
          const slub = smooth(x, 0, 3) * 0.6 + at(x, y) * 0.4;
          g = Math.min(1, (1 - ridge) * 0.75 + slub * 0.35);
          break;
        }
        case 'twill': {
          const d = (u * 64 + v * 64) % 1;
          h = 0.4 + 0.6 * Math.sin(Math.PI * d);
          g = 0.45 + (1 - Math.sin(Math.PI * d)) * 0.15 + (at(x, y) - 0.5) * 0.15;
          break;
        }
        case 'rib': {
          // Rib-knit: deep vertical ribs
          h = Math.abs(Math.sin(Math.PI * u * 16));
          g = 0.4 + h * 0.3;
          break;
        }
        case 'fleece': {
          h = smooth(x, y, 4);
          g = 0.5 + (smooth(x, y, 6) - 0.5) * 0.8;
          break;
        }
        case 'canvas': {
          const a = Math.sin(Math.PI * ((u * 48) % 1)), b = Math.sin(Math.PI * ((v * 48) % 1));
          h = 0.5 * a + 0.5 * b;
          g = 0.45 + (at(x, y) - 0.5) * 0.3;
          break;
        }
        case 'leather': {
          // Pebbled grain
          h = smooth(x, y, 1) ** 2;
          g = 0.5 + (smooth(x, y, 3) - 0.5) * 0.5;
          break;
        }
        case 'rubber': {
          h = at(x, y) * 0.3 + 0.35;
          g = 0.5;
          break;
        }
        default: {
          // Plain cotton weave
          const a = Math.sin(Math.PI * ((u * 64) % 1)), b = Math.sin(Math.PI * ((v * 64) % 1));
          h = 0.5 * a + 0.5 * b;
          g = 0.5 + (at(x, y) - 0.5) * 0.25;
        }
      }
      const i = (y * N + x) * 4;
      data[i] = Math.round(Math.max(0, Math.min(1, h)) * 255);
      data[i + 1] = Math.round(Math.max(0, Math.min(1, g)) * 255);
      data[i + 2] = Math.round(at(x * 3, y * 3) * 255);
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  weaves.set(kind, tex);
  return tex;
}

/** Where a garment's hems and seams are, measured on it at rest (set per garment worn) */
export interface GarmentLines {
  /** The hem's height (a top's or a trouser leg's), or -1000 for none */
  hemY: number;
  /** How far out the sleeves end (|x| at rest, arms out), and where an arm begins; -1 for no sleeves */
  sleeveX: number;
  shoulderX: number;
  /** Knee and hip height, for denim's fading */
  kneeY: number;
  hipY: number;
  /** The elbow's |x| at rest (long sleeves crease there), or -1 */
  elbowX?: number;
  /** A shoe's sole top (height at rest), or -1000 */
  soleY?: number;
  /** The middle of the chest at rest (where a print goes on a top) */
  chestY?: number;
}

/**
 * A garment's material in a fabric: the given material's kind (physical, with sheen) copied, in the look's
 * colour, with the weave, stitching and fading drawn on it.
 */
/** Each fabric material's own uniforms (hems, sleeves, the sole line), set once it is worn */
const FABRIC_UNIFORMS = new WeakMap<THREE.Material, Record<string, { value: unknown }>>();

export function fabricMaterial(from: THREE.Material, look: FabricLook): THREE.MeshPhysicalMaterial {
  const spec = SPECS[look.kind] ?? SPECS.cotton;
  const m = (from as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial
    ? ((from as THREE.MeshPhysicalMaterial).clone() as THREE.MeshPhysicalMaterial)
    : new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide });
  m.color.copy(look.colour);
  m.roughness = spec.roughness;
  m.metalness = 0;
  m.sheen = spec.sheen;
  m.sheenRoughness = 0.8;
  m.sheenColor = look.colour.clone().lerp(new THREE.Color(1, 1, 1), 0.35);
  const stitch = look.stitch ?? (look.kind === 'denim' ? new THREE.Color(0xc8902e) : look.colour.clone().multiplyScalar(0.62));
  const uniforms = {
    uFabric: { value: weave(look.kind) },
    uFabScale: { value: 1 / spec.tile },
    uBump: { value: spec.bump * 0.0045 },
    uVary: { value: spec.vary },
    uStitch: { value: new THREE.Vector4(stitch.r, stitch.g, stitch.b, spec.stitches ? 1 : 0) },
    uSeams: { value: spec.seams ? 1 : 0 },
    uFade: { value: spec.fade ? 0.5 + (look.wear ?? 0) * 0.5 : (look.wear ?? 0) * 0.3 },
    uHemY: { value: -1000 },
    uSleeveX: { value: -1 },
    uShoulderX: { value: 10 },
    uKneeY: { value: 0.5 },
    uHipY: { value: 0.95 },
    // Creases: where cloth bunches (knees and the back of them, elbows, a top's hem), 0 for none
    uElbowX: { value: -1 },
    uCrease: { value: look.kind === 'leather' || look.kind === 'rubber' ? 0 : 1 },
    // A shoe's sole, drawn by height (a level edge all round): its top, and its colour
    uSoleY: { value: -1000 },
    uSole: { value: new THREE.Color(look.kind === 'leather' ? 0x2a1d14 : 0xeeeeea) },
    // Pattern and print: which (0 plain), the second and third colours, repeat size, angle, the print's place
    uPat: { value: 0 },
    uPatA: { value: new THREE.Color() },
    uPatB: { value: new THREE.Color() },
    uPatScale: { value: 1 },
    uPatAngle: { value: 0 },
    uPatNoise: { value: patternNoise() },
    uPrint: { value: noPrint() },
    uPrintAt: { value: new THREE.Vector4(0, 1.3, 0.085, 0.085) },
    uPrintOff: { value: new THREE.Vector2() },
    // Condition
    uDirt: { value: look.dirt ?? 0 },
    uDamage: { value: look.damage ?? 0 },
  };
  setPattern(uniforms, look);
  // (kept beside the material, not in its userData: a clone deep-copies userData as JSON, which would
  // write the weave texture out as an image every time a person is dressed again)
  m.userData.fabric = look.kind;
  FABRIC_UNIFORMS.set(m, uniforms);
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFabPos;\nvarying vec3 vFabNor;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFabPos = position;\nvFabNor = normal;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vFabPos;
varying vec3 vFabNor;
uniform sampler2D uFabric;
uniform float uFabScale, uBump, uVary, uSeams, uFade, uHemY, uSleeveX, uShoulderX, uKneeY, uHipY, uElbowX, uCrease, uSoleY;
uniform vec4 uStitch;
uniform vec3 uSole;
uniform float uPat, uPatScale, uPatAngle, uDirt, uDamage;
uniform vec3 uPatA, uPatB;
uniform sampler2D uPatNoise, uPrint;
uniform vec4 uPrintAt;
uniform vec2 uPrintOff;
// A pattern on one flat view of the cloth (uv in metres): how much of the second (x) and third (y) colour
vec2 fabPatternAt(vec2 uv) {
  float s = 0.04 * uPatScale;
  float a = radians(uPatAngle);
  vec2 r = vec2(cos(a) * uv.x + sin(a) * uv.y, -sin(a) * uv.x + cos(a) * uv.y);
  if (uPat < 1.5) {
    // Stripes: bands of the second colour, edged with a fine line of the third
    float f = fract(r.y / s);
    float band = smoothstep(0.47, 0.5, f) * (1.0 - smoothstep(0.97, 1.0, f));
    float edge = 1.0 - smoothstep(0.0, 0.035, min(abs(f - 0.5), abs(f - 0.985)));
    return vec2(band, edge * 0.85);
  }
  if (uPat < 2.5) {
    // Pinstripe: fine lines of the second colour, well apart
    float f = fract(r.x / (s * 0.6));
    return vec2(1.0 - smoothstep(0.03, 0.07, abs(f - 0.5)), 0.0);
  }
  if (uPat < 3.5) {
    // Check (gingham): crossing bands; where both cross the second colour, where one crosses half of it;
    // a fine line of the third through every other band
    float bx = step(0.5, fract(r.x / s)), by = step(0.5, fract(r.y / s));
    float fine = (1.0 - smoothstep(0.0, 0.02, abs(fract(r.x / (2.0 * s)) - 0.75))) * (1.0 - by);
    return vec2(bx * by + (bx + by - 2.0 * bx * by) * 0.5, fine);
  }
  if (uPat < 4.5) {
    // Camouflage: blotches at two sizes in the second and third colours over the cloth's own
    vec3 n = texture2D(uPatNoise, uv / (0.38 * uPatScale)).rgb;
    float b1 = smoothstep(0.5, 0.54, n.r);
    float b2 = smoothstep(0.58, 0.62, n.g);
    return vec2(b1 * (1.0 - b2), b2);
  }
  // Ankara: cells of rings, every other cell a flower of petals, each with its centre in the third colour
  vec2 cell = uv / (0.1 * uPatScale);
  vec2 id = floor(cell);
  vec2 q = fract(cell) - 0.5;
  float d = length(q);
  float odd = mod(id.x + id.y, 2.0);
  float rings = step(0.5, fract(d * 7.0)) * step(d, 0.46);
  float ang = atan(q.y, q.x);
  float petals = step(d, 0.42 * (0.55 + 0.45 * abs(cos(ang * 3.0))));
  float centre = step(d, 0.09);
  return vec2(mix(rings, petals, odd) * (1.0 - centre), centre);
}
// The pattern on the cloth, seen from three sides as the weave is
vec2 fabPattern(vec3 p, vec3 n) {
  vec3 w = pow(abs(n), vec3(4.0));
  w /= (w.x + w.y + w.z + 1e-5);
  vec2 sum = vec2(0.0);
  if (w.z > 0.02) sum += fabPatternAt(vec2(p.x, p.y)) * w.z;
  if (w.x > 0.02) sum += fabPatternAt(vec2(p.z, p.y)) * w.x;
  if (w.y > 0.02) sum += fabPatternAt(vec2(p.x, p.z)) * w.y;
  return sum;
}
// Soft creases where cloth bunches: across the leg at the knee, round the arm at the elbow, above a top's hem;
// and the cloth's own gentle unevenness everywhere (seen from any distance)
float fabCreases(vec3 p, vec3 n) {
  float c = 0.0;
  if (uCrease <= 0.0) return 0.0;
  // Knees: rings of folds round the leg, deepest at the back of the knee
  float kneeBand = exp(-pow((p.y - uKneeY) / 0.06, 2.0));
  c += kneeBand * (0.6 + 0.4 * smoothstep(0.2, -0.6, n.z)) * sin(p.y * 160.0 + sin(p.x * 40.0) * 2.0);
  // Elbows (the arm along x at rest)
  if (uElbowX > 0.0) c += exp(-pow((abs(p.x) - uElbowX) / 0.05, 2.0)) * sin(abs(p.x) * 170.0 + p.z * 30.0) * 0.8;
  // A top hangs in soft folds that deepen toward its hem (not on the sleeves)
  if (uHemY > -999.0 && uSleeveX > 0.0 && abs(p.x) < uShoulderX) c += smoothstep(uHemY + 0.32, uHemY + 0.02, p.y) * sin(p.x * 48.0 + n.z * 2.5 + sin(p.y * 9.0) * 1.5) * 0.7;
  // A top bunches a little just above its hem
  if (uHemY > -999.0 && uSleeveX > 0.0) c += exp(-pow((p.y - uHemY - 0.06) / 0.05, 2.0)) * sin(p.y * 140.0 + p.x * 25.0) * 0.5;
  return c;
}
// The weave seen from three sides, blended by which way the cloth faces at rest
vec3 fabWeave(vec3 p, vec3 n) {
  vec3 w = pow(abs(n), vec3(4.0));
  w /= (w.x + w.y + w.z + 1e-5);
  return texture2D(uFabric, p.zy * uFabScale).rgb * w.x + texture2D(uFabric, p.xz * uFabScale).rgb * w.y + texture2D(uFabric, p.xy * uFabScale).rgb * w.z;
}
// A row of stitches along a line at distance d (metres) from it, running along 'along'
float fabStitchRow(float d, float along) {
  float line = 1.0 - smoothstep(0.0006, 0.0014, abs(d));
  float dash = smoothstep(0.25, 0.35, fract(along * 260.0)) * (1.0 - smoothstep(0.75, 0.85, fract(along * 260.0)));
  return line * dash;
}
vec3 perturbFab(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDir) {
  vec3 vSigmaX = normalize(dFdx(surf_pos.xyz));
  vec3 vSigmaY = normalize(dFdy(surf_pos.xyz));
  vec3 R1 = cross(vSigmaY, surf_norm);
  vec3 R2 = cross(surf_norm, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDir;
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surf_norm - vGrad);
}`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
vec3 fabN = normalize(vFabNor);
vec3 fab = fabWeave(vFabPos, fabN);
// The pattern under everything else (the weave, stitches and wear go over it)
if (uPat > 0.5 && uPat < 5.5) {
  vec2 pat = fabPattern(vFabPos, fabN);
  diffuseColor.rgb = mix(mix(diffuseColor.rgb, uPatA, clamp(pat.x, 0.0, 1.0)), uPatB, clamp(pat.y, 0.0, 1.0));
}
// A print on the front of a top's chest (a graphic or a logo), the weave still showing through its ink
if (uPat > 5.5 && fabN.z > 0.25 && abs(vFabPos.x) < uShoulderX) {
  vec2 c = uPrintAt.xy + uPrintOff;
  vec2 puv = vec2((vFabPos.x - c.x) / (2.0 * uPrintAt.z) + 0.5, 0.5 + (vFabPos.y - c.y) / (2.0 * uPrintAt.w));
  if (puv.x > 0.0 && puv.x < 1.0 && puv.y > 0.0 && puv.y < 1.0) {
    vec4 ink = texture2D(uPrint, puv);
    diffuseColor.rgb = mix(diffuseColor.rgb, ink.rgb * (0.9 + 0.1 * fab.g), ink.a * 0.95);
  }
}
float fabNear = 1.0 - smoothstep(5.0, 16.0, length(vViewPosition));
diffuseColor.rgb *= mix(1.0, 0.72 + 0.56 * fab.g, uVary * mix(0.5, 1.0, fabNear));
// Denim (and wear): lighter down the front of the thighs and over the knees, where jeans fade
if (uFade > 0.0) {
  float span = max(0.05, uHipY - uKneeY);
  float thigh = smoothstep(uKneeY - span * 0.25, uKneeY + span * 0.2, vFabPos.y) * (1.0 - smoothstep(uHipY - span * 0.25, uHipY, vFabPos.y));
  float front = smoothstep(0.2, 0.85, fabN.z);
  float knee = (1.0 - smoothstep(0.0, span * 0.22, abs(vFabPos.y - uKneeY))) * smoothstep(0.3, 0.9, fabN.z);
  float f = clamp((thigh * front * 0.8 + knee * 0.5) * uFade * (0.7 + 0.6 * fab.b), 0.0, 1.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.55 + vec3(0.05, 0.06, 0.08), f);
}
// Topstitching: a double row along the hem, at a sleeve's end, and beside the outside seam of each leg
float fabStitch = 0.0;
if (uStitch.a > 0.0 && fabNear > 0.0) {
  bool arm = abs(vFabPos.x) > uShoulderX;
  if (uHemY > -999.0 && !arm) {
    float d = vFabPos.y - (uHemY + 0.012);
    fabStitch = max(fabStitchRow(d, vFabPos.x + vFabPos.z), fabStitchRow(d - 0.0065, vFabPos.x + vFabPos.z));
  }
  if (uSleeveX > 0.0 && arm) {
    float d = abs(vFabPos.x) - (uSleeveX - 0.012);
    fabStitch = max(fabStitch, max(fabStitchRow(d, vFabPos.y + vFabPos.z), fabStitchRow(d + 0.0065, vFabPos.y + vFabPos.z)));
  }
  if (uSeams > 0.5) {
    // The outside seam of each leg: where the cloth faces straight out to the side at rest
    float outward = fabN.x * sign(vFabPos.x);
    float seam = smoothstep(0.975, 0.992, outward);
    diffuseColor.rgb *= 1.0 - 0.35 * seam;
    float beside = 1.0 - smoothstep(0.004, 0.012, abs(outward - 0.955));
    float dash = smoothstep(0.25, 0.35, fract(vFabPos.y * 260.0)) * (1.0 - smoothstep(0.75, 0.85, fract(vFabPos.y * 260.0)));
    fabStitch = max(fabStitch, beside * dash);
  }
  diffuseColor.rgb = mix(diffuseColor.rgb, uStitch.rgb, fabStitch * uStitch.a * fabNear);
}
// The cloth's broad unevenness (a mottle a few centimetres across, as real cloth is never one flat colour)
float fabMottle = texture2D(uFabric, vFabPos.xy * 2.5 + vFabPos.zz * 1.7).b;
diffuseColor.rgb *= 0.94 + 0.12 * fabMottle;
float fabFolds = fabCreases(vFabPos, fabN);
diffuseColor.rgb *= 1.0 - 0.06 * max(0.0, -fabFolds);
// Condition. Dirt: grime that gathers low (trouser hems, shoes), at the knees and cuffs, in blotches
if (uDirt > 0.0) {
  vec3 dn = texture2D(uPatNoise, vFabPos.xy * 1.7 + vFabPos.zz * 1.3).rgb;
  float low = 1.0 - smoothstep(0.05, 0.55, vFabPos.y);
  float knee = exp(-pow((vFabPos.y - uKneeY) / 0.08, 2.0)) * smoothstep(0.0, 0.6, fabN.z);
  float cuff = uSleeveX > 0.0 ? smoothstep(uSleeveX - 0.12, uSleeveX, abs(vFabPos.x)) : 0.0;
  // Stains in patches (about half the cloth near the ground and the knees, a few elsewhere), toward Lagos red-brown dust
  float stain = smoothstep(0.6, 0.9, dn.r + dn.b * 0.3);
  float grime = clamp((0.18 + low * 1.1 + knee * 0.9 + cuff * 0.7) * (0.25 + 0.75 * stain), 0.0, 0.92) * uDirt;
  vec3 mud = vec3(0.075, 0.045, 0.024) + diffuseColor.rgb * 0.12;
  diffuseColor.rgb = mix(diffuseColor.rgb, mud, grime);
}
// Damage: thin, washed-out spots where cloth rubs, darker frayed edges along the hems
float fabWorn = 0.0;
if (uDamage > 0.0) {
  vec3 dn = texture2D(uPatNoise, vFabPos.xy * 3.1 + vFabPos.zz * 2.2).rgb;
  float kneeW = exp(-pow((vFabPos.y - uKneeY) / 0.07, 2.0)) * smoothstep(0.1, 0.7, fabN.z);
  float thighW = smoothstep(uKneeY, uKneeY + 0.08, vFabPos.y) * (1.0 - smoothstep(uHipY - 0.06, uHipY, vFabPos.y)) * smoothstep(0.3, 0.8, fabN.z) * 0.6;
  float seatW = smoothstep(uHipY - 0.16, uHipY - 0.04, vFabPos.y) * (1.0 - smoothstep(uHipY, uHipY + 0.08, vFabPos.y)) * smoothstep(0.3, 0.8, -fabN.z) * 0.7;
  float elbowW = uElbowX > 0.0 ? exp(-pow((abs(vFabPos.x) - uElbowX) / 0.05, 2.0)) : 0.0;
  float rubbed = clamp(kneeW + thighW + seatW + elbowW, 0.0, 1.0);
  fabWorn = smoothstep(0.52, 0.66, dn.g + dn.b * 0.25) * rubbed * uDamage;
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.8 + vec3(0.06), fabWorn * 0.8);
  if (uHemY > -999.0) {
    float edge = 1.0 - smoothstep(0.0, 0.018, vFabPos.y - uHemY);
    diffuseColor.rgb *= 1.0 - edge * uDamage * 0.35 * step(0.4, dn.b);
  }
}
// A shoe's sole: everything below its top in the sole's colour, a fine line where they meet
if (vFabPos.y < uSoleY) diffuseColor.rgb = uSole;
diffuseColor.rgb *= 1.0 - 0.35 * (1.0 - smoothstep(0.0, 0.0015, abs(vFabPos.y - uSoleY)));`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
// The threads catch the light (close up; flat far off, so nothing shimmers)
float fabH = (fab.r * (1.0 - fabWorn * 0.7) - fabStitch * 0.4) * uBump * fabNear + fabFolds * 0.0035 + fabMottle * 0.0012;
normal = perturbFab(-vViewPosition, normal, vec2(dFdx(fabH), dFdy(fabH)) * 40.0, faceDirection);`,
      );
  };
  m.customProgramCacheKey = () => 'fabric';
  return m;
}

/** A fabric material's own uniforms (read by the tests; null for any other material) */
export function fabricUniforms(material: THREE.Material): Record<string, { value: unknown }> | null {
  return FABRIC_UNIFORMS.get(material) ?? null;
}

/** Sets where a worn garment's hems and seams are, from its own shape at rest and the skeleton's joints */
export function setGarmentLines(material: THREE.Material, lines: GarmentLines): void {
  const u = FABRIC_UNIFORMS.get(material);
  if (!u) return;
  u.uHemY.value = lines.hemY;
  u.uSleeveX.value = lines.sleeveX;
  u.uShoulderX.value = lines.shoulderX;
  u.uKneeY.value = lines.kneeY;
  u.uHipY.value = lines.hipY;
  u.uElbowX.value = lines.elbowX ?? -1;
  u.uSoleY.value = lines.soleY ?? -1000;
  if (lines.chestY !== undefined) (u.uPrintAt.value as THREE.Vector4).y = lines.chestY;
}

/** A look's pattern or print, set on a fabric material's uniforms (colours, size, angle, the print texture) */
function setPattern(u: Record<string, { value: unknown }>, look: FabricLook): void {
  const p = look.pattern;
  const kind = p?.kind ?? 'plain';
  u.uPat.value = PATTERN_ID[kind] ?? 0;
  if (!p || kind === 'plain') return;
  const c2 = p.colour2 ?? '#111827';
  const c3 = p.colour3 ?? '#facc15';
  (u.uPatA.value as THREE.Color).set(c2);
  (u.uPatB.value as THREE.Color).set(c3);
  u.uPatScale.value = p.scale ?? 1;
  u.uPatAngle.value = p.angle ?? 0;
  if (kind === 'graphic' || kind === 'logo') {
    u.uPrint.value = kind === 'graphic' ? graphicPrint(p.design ?? 'eko_sun', c2, c3) : logoPrint(p.text ?? '', p.shape ?? 'circle', c2, c3);
    // A print about 17 cm across at its usual size, moved about the chest by up to 6 cm each way
    const half = 0.085 * (p.scale ?? 1);
    (u.uPrintAt.value as THREE.Vector4).z = half;
    (u.uPrintAt.value as THREE.Vector4).w = half;
    (u.uPrintOff.value as THREE.Vector2).set((p.x ?? 0) * 0.06, (p.y ?? 0) * 0.06);
  }
}
