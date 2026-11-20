import * as THREE from 'three';

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
 * Printed designs, logos and dirt slot in here later without another material.
 */
export type FabricKind = 'jersey' | 'pique' | 'oxford' | 'denim' | 'twill' | 'rib' | 'fleece' | 'canvas' | 'leather' | 'rubber' | 'cotton';

export interface FabricLook {
  kind: FabricKind;
  colour: THREE.Color;
  /** Thread colour for topstitching (denim's gold by default; a shade of the cloth otherwise) */
  stitch?: THREE.Color;
  /** How worn: 0 new, 1 faded and grubby (denim fades on the thighs at any wear) */
  wear?: number;
}

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
  };
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
// A shoe's sole: everything below its top in the sole's colour, a fine line where they meet
if (vFabPos.y < uSoleY) diffuseColor.rgb = uSole;
diffuseColor.rgb *= 1.0 - 0.35 * (1.0 - smoothstep(0.0, 0.0015, abs(vFabPos.y - uSoleY)));`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
// The threads catch the light (close up; flat far off, so nothing shimmers)
float fabH = (fab.r - fabStitch * 0.4) * uBump * fabNear + fabFolds * 0.0035 + fabMottle * 0.0012;
normal = perturbFab(-vViewPosition, normal, vec2(dFdx(fabH), dFdy(fabH)) * 40.0, faceDirection);`,
      );
  };
  m.customProgramCacheKey = () => 'fabric';
  return m;
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
}
