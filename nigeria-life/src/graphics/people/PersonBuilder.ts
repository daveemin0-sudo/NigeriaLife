import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { HumanConfig, HumanRig } from '../HumanMeshBuilder';
import { fabric, hairGrain, type Pattern } from './Fabrics';

/**
 * People as people: smooth bodies in true proportion, a head of the shape chosen with a real
 * face on it (eyes with irises and lids, brows, a broad nose, full lips, ears, a beard if worn),
 * hair styled the way Lagos wears it, and clothes cut as garments from real cloth (ankara, aso-oke,
 * denim, lace, cotton) over the body. The skeleton is the game's own (the same joints at the same
 * places as before), so every walk, seat, dance and pose works on them as it did.
 */

export type HeadShape = 'round' | 'oval' | 'long' | 'square' | 'heart' | 'diamond';
export type Beard = 'none' | 'stubble' | 'moustache' | 'goatee' | 'full' | 'chinstrap';
export type Build = 'slim' | 'average' | 'broad';
export type Hat = 'none' | 'fila' | 'gele' | 'cap' | 'hardhat' | 'police_cap' | 'pilot_cap' | 'chef_toque' | 'beret';

type Sleeve = 'none' | 'short' | 'long' | 'wide';
type TopKind = 'tee' | 'shirt' | 'polo' | 'hoodie' | 'blouse' | 'kaftan' | 'agbada' | 'jacket' | 'coat' | 'dress' | 'gown' | 'overall' | 'chef' | 'jersey' | 'buba';
type BottomKind = 'trousers' | 'jeans' | 'joggers' | 'shorts' | 'skirt' | 'wrapper' | 'none';

interface Cut {
  top: TopKind;
  sleeves: Sleeve;
  /** Where the top ends, as a height above the ground in metres */
  hem: number;
  pattern: Pattern;
  colour: number;
  accent: number;
  collar: boolean;
  buttons: boolean;
  bottom: BottomKind;
  bottomColour: number;
  bottomPattern: Pattern;
  /** A hi-vis vest, epaulettes, a white coat over it all */
  vest?: number;
  epaulettes?: boolean;
  coat?: number;
  hood?: boolean;
}

const SKIN_DEFAULT = { male: '#6b4430', female: '#7a4b33' };

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Head shapes as widths at the brow, the cheekbones and the jaw, and the face's length */
const SHAPES: Record<HeadShape, { w: number; h: number; d: number; jaw: number; brow: number; cheek: number; chin: number }> = {
  round: { w: 0.9, h: 1.05, d: 1.0, jaw: 0.95, brow: 0.97, cheek: 1.02, chin: 0.98 },
  oval: { w: 0.86, h: 1.1, d: 1.0, jaw: 0.86, brow: 0.95, cheek: 1.0, chin: 1.02 },
  long: { w: 0.83, h: 1.17, d: 0.99, jaw: 0.88, brow: 0.95, cheek: 0.98, chin: 1.04 },
  square: { w: 0.92, h: 1.04, d: 1.0, jaw: 1.03, brow: 1.0, cheek: 1.0, chin: 0.97 },
  heart: { w: 0.89, h: 1.08, d: 1.0, jaw: 0.8, brow: 1.03, cheek: 1.02, chin: 1.03 },
  diamond: { w: 0.86, h: 1.1, d: 1.0, jaw: 0.82, brow: 0.88, cheek: 1.07, chin: 1.03 },
};

/** How a point on a round head of radius 1 moves for the chosen shape: its width, height and depth there */
function headScale(ny: number, nz: number, shape: HeadShape): [number, number, number] {
  const s = SHAPES[shape];
  let w = s.w * 0.86;
  if (ny < -0.08) w *= lerp(1, s.jaw, smooth(0.08, 0.85, -ny));
  else if (ny > 0.32) w *= lerp(1, s.brow, smooth(0.32, 0.92, ny));
  // Cheekbones, a little below the eyes
  w *= lerp(1, s.cheek, 1 - Math.min(1, Math.abs(ny + 0.05) / 0.3));
  let d = s.d * 0.9;
  // The face is flatter in front than the back of the head; the chin comes forward; the nape tucks in
  if (nz > 0 && Math.abs(ny) < 0.55) d *= 0.95;
  if (nz > 0 && ny < -0.6) d *= s.chin;
  if (nz < 0 && ny < -0.35) d *= lerp(1, 0.82, smooth(0.35, 0.9, -ny));
  return [w, s.h, d];
}

/** Bends a sphere-like geometry of radius `r`, centred on 0, into the chosen head shape */
function shapeIt(geo: THREE.BufferGeometry, r: number, shape: HeadShape): THREE.BufferGeometry {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const [w, h, d] = headScale(y / r, z / r, shape);
    pos.setXYZ(i, x * w, y * h, z * d);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** Where on the face a point is: across (azimuth, 0 = straight ahead), up (-1 chin .. 1 crown), and how far out */
function onHead(r: number, shape: HeadShape, az: number, ny: number, out = 1): THREE.Vector3 {
  const ring = Math.sqrt(Math.max(0, 1 - ny * ny));
  const x = Math.sin(az) * ring;
  const z = Math.cos(az) * ring;
  const [w, h, d] = headScale(ny, z, shape);
  return new THREE.Vector3(x * w * r * out, ny * h * r * out, z * d * r * out);
}

/** A smooth upright body part: a lathe through (radius, height) points, squashed to an oval */
function lathe(points: Array<[number, number]>, segments: number, sx = 1, sz = 1): THREE.BufferGeometry {
  // Bottom to top, so the surface faces outward
  const ordered = points.map((p, i) => ({ p, i })).sort((a, b) => a.p[1] - b.p[1] || a.i - b.i).map(({ p }) => p);
  const geo = new THREE.LatheGeometry(ordered.map(([r, y]) => new THREE.Vector2(Math.max(0.0005, r), y)), segments);
  geo.scale(sx, 1, sz);
  geo.computeVertexNormals();
  const n = geo.getAttribute('normal') as THREE.BufferAttribute;
  const rows = ordered.length;
  for (let j = 0; j < rows; j++) {
    const a = j;
    const b = segments * rows + j;
    const x = (n.getX(a) + n.getX(b)) / 2;
    const y = (n.getY(a) + n.getY(b)) / 2;
    const z = (n.getZ(a) + n.getZ(b)) / 2;
    const l = Math.hypot(x, y, z) || 1;
    n.setXYZ(a, x / l, y / l, z / l);
    n.setXYZ(b, x / l, y / l, z / l);
  }
  return geo;
}

/** Keeps only the triangles of a shell above a line round the head (the hairline), by their middles */
function cutBelow(geo: THREE.BufferGeometry, keep: (x: number, y: number, z: number) => boolean): THREE.BufferGeometry {
  const pos = geo.getAttribute('position');
  const index = geo.getIndex();
  if (!index) return geo;
  const kept: number[] = [];
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);
    const x = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3;
    const y = (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3;
    const z = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3;
    if (keep(x, y, z)) kept.push(a, b, c);
  }
  geo.setIndex(kept);
  return geo;
}

/** What each of the game's outfits is, as clothes: which top, how long, what sleeves, of what cloth, over what */
function cutFor(config: HumanConfig, female: boolean): Cut {
  const c = config.outfitColor ?? (female ? 0x2563eb : 0x1f7a4d);
  const second = config.secondaryColor ?? 0xf5f5f4;
  const trousers = config.trousersColor ?? (female ? 0x1e293b : 0x1f2937);
  const pattern = (config.pattern as Pattern | undefined);
  const accent = config.accentColor ?? second;
  const base: Cut = { top: 'tee', sleeves: 'short', hem: female ? 0.86 : 0.9, pattern: pattern ?? 'plain', colour: c, accent, collar: false, buttons: false, bottom: 'trousers', bottomColour: trousers, bottomPattern: 'plain' };
  switch (config.outfit) {
    case 'agbada': return { ...base, top: 'agbada', sleeves: 'wide', hem: 0.28, pattern: pattern ?? 'aso_oke', accent: config.accentColor ?? 0xe5b84b, collar: false, bottom: 'trousers', bottomColour: config.trousersColor ?? c };
    case 'senator':
    case 'kaftan': return { ...base, top: 'kaftan', sleeves: 'long', hem: 0.5, collar: true, buttons: false, bottom: 'trousers', bottomColour: config.trousersColor ?? c, pattern: pattern ?? 'plain' };
    case 'blue_dress': return { ...base, top: 'dress', sleeves: 'short', hem: 0.42, pattern: pattern ?? 'ankara', accent: config.accentColor ?? 0xfacc15, bottom: 'none' };
    case 'ankara_gown': return { ...base, top: 'gown', sleeves: 'short', hem: 0.06, pattern: pattern ?? 'ankara', accent: config.accentColor ?? 0xfacc15, bottom: 'none' };
    case 'bodycon': return { ...base, top: 'dress', sleeves: 'none', hem: 0.5, pattern: pattern ?? 'plain', bottom: 'none' };
    case 'buba_iro': return { ...base, top: 'buba', sleeves: 'long', hem: 0.86, pattern: pattern ?? 'lace', bottom: 'wrapper', bottomColour: config.trousersColor ?? c, bottomPattern: 'aso_oke' };
    case 'peplum_skirt': return { ...base, top: 'blouse', sleeves: 'short', hem: 0.86, pattern: pattern ?? 'ankara', accent: config.accentColor ?? 0xfacc15, bottom: 'skirt', bottomColour: config.trousersColor ?? c, bottomPattern: 'ankara' };
    case 'casual_blouse': return { ...base, top: 'blouse', sleeves: 'short', hem: 0.86, bottom: female ? 'jeans' : 'trousers', bottomColour: config.trousersColor ?? 0x1e3a8a, bottomPattern: 'denim' };
    case 'casual_tee':
    case 'tshirt': return { ...base, top: 'tee', bottom: 'jeans', bottomColour: config.trousersColor ?? 0x1e3a8a, bottomPattern: 'denim' };
    case 'polo_shirt': return { ...base, top: 'polo', collar: true, buttons: true, bottom: 'trousers', bottomColour: config.trousersColor ?? 0xd6c7a1 };
    case 'button_shirt': return { ...base, top: 'shirt', sleeves: 'long', collar: true, buttons: true, pattern: pattern ?? 'check', accent: config.accentColor ?? 0xffffff, bottom: 'jeans', bottomColour: config.trousersColor ?? 0x1e3a8a, bottomPattern: 'denim' };
    case 'ankara_shirt': return { ...base, top: 'shirt', sleeves: 'short', collar: true, buttons: true, pattern: 'ankara', accent: config.accentColor ?? 0xfacc15, bottom: 'trousers', bottomColour: config.trousersColor ?? 0x111827 };
    case 'hoodie': return { ...base, top: 'hoodie', sleeves: 'long', hem: female ? 0.82 : 0.86, pattern: 'knit', hood: true, bottom: 'joggers', bottomColour: config.trousersColor ?? 0x374151 };
    case 'jersey': return { ...base, top: 'jersey', pattern: 'stripes', accent: config.accentColor ?? 0xffffff, bottom: 'shorts', bottomColour: config.trousersColor ?? 0xffffff };
    case 'suit':
    case 'lecturer_suit': return { ...base, top: 'jacket', sleeves: 'long', hem: 0.78, collar: true, buttons: true, colour: config.outfitColor ?? 0x1f2937, accent: 0xffffff, bottom: 'trousers', bottomColour: config.trousersColor ?? config.outfitColor ?? 0x1f2937 };
    case 'jumpsuit': return { ...base, top: 'overall', sleeves: 'none', hem: 0.86, bottom: 'trousers', bottomColour: c };
    case 'doctor_coat': return { ...base, top: 'shirt', sleeves: 'long', collar: true, buttons: true, colour: 0xbfdbfe, coat: 0xffffff, bottom: 'trousers', bottomColour: 0x1f2937 };
    case 'nurse_scrubs': return { ...base, top: 'tee', sleeves: 'short', colour: 0x38bdf8, bottom: 'trousers', bottomColour: 0x38bdf8 };
    case 'pilot_uniform': return { ...base, top: 'shirt', sleeves: 'short', collar: true, buttons: true, colour: 0xffffff, epaulettes: true, bottom: 'trousers', bottomColour: 0x111827 };
    case 'security_uniform': return { ...base, top: 'shirt', sleeves: 'short', collar: true, buttons: true, colour: 0x1f2937, bottom: 'trousers', bottomColour: 0x111827 };
    case 'traffic_warden': return { ...base, top: 'shirt', sleeves: 'short', collar: true, buttons: true, colour: 0xfacc15, bottom: 'trousers', bottomColour: 0x7f1d1d };
    case 'chef_attire': return { ...base, top: 'chef', sleeves: 'long', collar: true, buttons: true, colour: 0xffffff, bottom: 'trousers', bottomColour: 0x111827, bottomPattern: 'check' };
    case 'mechanic_overalls': return { ...base, top: 'overall', sleeves: 'long', colour: 0x1d4ed8, bottom: 'trousers', bottomColour: 0x1d4ed8 };
    case 'engineer_vest': return { ...base, top: 'shirt', sleeves: 'long', collar: true, buttons: true, colour: 0x1e3a8a, vest: 0xf97316, bottom: 'jeans', bottomColour: 0x1e3a8a, bottomPattern: 'denim' };
    case 'student_casual': return { ...base, top: 'polo', collar: true, buttons: true, bottom: 'jeans', bottomColour: 0x1e3a8a, bottomPattern: 'denim' };
    default: return base;
  }
}

/** The hair a hat-wearing look still has, and the hat, from the old single setting */
function hairAndHat(config: HumanConfig, female: boolean): { hair: string; hat: Hat } {
  const style = config.hairstyle ?? (female ? 'box_braids' : 'low_cut');
  const hats: Record<string, Hat> = { fila: 'fila', gele: 'gele', hardhat: 'hardhat', police_cap: 'police_cap', pilot_cap: 'pilot_cap', chef_toque: 'chef_toque', cap: 'cap', beret: 'beret' };
  const hat = (config.hat as Hat | undefined) ?? hats[style] ?? 'none';
  const hair = hats[style] ? (config.hair ?? (female ? 'bun' : 'low_cut')) : style;
  return { hair, hat };
}

export function buildPerson(config: HumanConfig, nameTag: (username: string) => THREE.Sprite): HumanRig {
  const female = config.gender === 'female';
  const detailed = config.lod !== 'street';
  const seg = detailed ? 28 : 14;
  const group = new THREE.Group();
  const materials: THREE.Material[] = [];
  // One material for each look of surface, so pieces alike can be drawn together
  const made = new Map<string, THREE.MeshStandardMaterial>();
  const mat = (colour: number | string, rough = 0.7, map: THREE.Texture | null = null, metal = 0) => {
    const key = `${new THREE.Color(colour).getHex()}|${rough}|${map?.uuid ?? ''}|${metal}`;
    const known = made.get(key);
    if (known) return known;
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(colour), roughness: rough, metalness: metal, map: map ?? undefined });
    materials.push(m);
    made.set(key, m);
    return m;
  };
  const build: Build = (config.build as Build | undefined) ?? 'average';
  const breadth = build === 'slim' ? 0.92 : build === 'broad' ? 1.1 : 1;
  const shape: HeadShape = (config.headShape as HeadShape | undefined) ?? (female ? 'oval' : 'round');
  const skinHex = config.skinTone || (female ? SKIN_DEFAULT.female : SKIN_DEFAULT.male);
  const skin = mat(skinHex, 0.48);
  const skinDeep = mat(new THREE.Color(skinHex).multiplyScalar(0.78).getHex(), 0.6);
  const hairColour = new THREE.Color(config.hairColor ?? '#0b0908').getHex();
  const cut = cutFor(config, female);
  const top = mat(cut.colour, cut.pattern === 'lace' ? 0.6 : 0.78, fabric(cut.pattern, cut.colour, cut.accent, 0x111827));
  const trim = mat(cut.accent, 0.6);
  const bottom = mat(cut.bottomColour, cut.bottomPattern === 'denim' ? 0.85 : 0.75, fabric(cut.bottomPattern, cut.bottomColour, cut.top === 'chef' ? 0xffffff : 0x111827, 0x111827));
  const dark = mat(0x0b0b0c, 0.5);

  // Ground shadow
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false });
  materials.push(shadowMat);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 18), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  group.add(shadow);

  // ---------------------------------------------------------------- Torso
  const torsoY = female ? 1.05 : 1.1;
  const torso = new THREE.Group();
  torso.position.y = torsoY;
  group.add(torso);
  const sx = (female ? 1.22 : 1.28) * breadth;
  const sz = (female ? 0.8 : 0.74) * (build === 'broad' ? 1.06 : 1);
  const profile: Array<[number, number]> = female
    ? [[0.0, -0.36], [0.15, -0.34], [0.19, -0.26], [0.178, -0.16], [0.138, -0.06], [0.142, 0.04], [0.156, 0.13], [0.164, 0.2], [0.16, 0.245], [0.12, 0.29], [0.075, 0.33], [0.06, 0.37], [0.0, 0.375]]
    : [[0.0, -0.38], [0.15, -0.36], [0.176, -0.3], [0.166, -0.2], [0.154, -0.1], [0.166, 0.02], [0.188, 0.14], [0.2, 0.22], [0.196, 0.27], [0.15, 0.32], [0.092, 0.37], [0.074, 0.41], [0.0, 0.415]];
  const hemLocal = Math.min(cut.hem, torsoY - 0.02) - torsoY;
  // What shows of the torso: the top down to its hem (or to the waist for a long top, its skirt drawn after), the bottom under it
  const topTo = cut.hem < torsoY - 0.36 ? -0.36 : hemLocal;
  const upper = profile.filter(([, y]) => y >= topTo - 0.001);
  if (upper[0][1] > topTo) upper.unshift([interp(profile, topTo) + 0.006, topTo]);
  const torsoTop = new THREE.Mesh(lathe(upper.map(([r, y]) => [r + 0.006, y]), seg, sx, sz), top);
  torso.add(torsoTop);
  if (cut.bottom !== 'none' || cut.hem > torsoY - 0.36) {
    const lower = profile.filter(([, y]) => y <= topTo + 0.02);
    lower.push([interp(profile, topTo + 0.02), topTo + 0.02]);
    const showsSkin = cut.bottom === 'none';
    torso.add(new THREE.Mesh(lathe(lower.map(([r, y]) => [r + 0.003, y]), seg, sx * 0.99, sz * 0.99), showsSkin ? skin : bottom));
  }
  // A belt at the waist for trousers worn with a short top
  if (detailed && (cut.bottom === 'trousers' || cut.bottom === 'jeans') && cut.hem > torsoY - 0.3 && cut.top !== 'kaftan' && cut.top !== 'agbada' && cut.top !== 'jacket') {
    const beltY = Math.max(hemLocal - 0.02, -0.3);
    const belt = new THREE.Mesh(lathe([[interp(profile, beltY) + 0.012, beltY - 0.018], [interp(profile, beltY) + 0.012, beltY + 0.018]], seg, sx, sz), mat(0x1c1917, 0.4, fabric('leather', 0x1c1917)));
    torso.add(belt);
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.032, 0.01), mat(0xd4af37, 0.3, null, 0.8));
    buckle.position.set(0, beltY, interp(profile, beltY) * sz + 0.016);
    torso.add(buckle);
  }
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(1, seg, seg / 2), torsoTop.material as THREE.Material);
    shoulder.scale.set((female ? 0.1 : 0.12) * breadth, female ? 0.05 : 0.058, female ? 0.072 : 0.085);
    shoulder.position.set(side * (female ? 0.17 : 0.22) * breadth, female ? 0.245 : 0.272, -0.004);
    shoulder.rotation.z = side * -0.32;
    torso.add(shoulder);
  }
  if (female) {
    // The bust, under the top
    for (const s of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, seg / 2, seg / 3), top);
      b.scale.set(1.05, 0.8, 0.5);
      b.position.set(s * 0.064, 0.125, 0.092);
      torso.add(b);
    }
  }
  // A long top's skirt: a kaftan to the knee, a dress, a gown, the white coat, the agbada's robe
  const skirtTop = female ? -0.08 : -0.12;
  const skirtTo = cut.hem - torsoY;
  if (skirtTo < -0.36) {
    const flare = cut.top === 'gown' ? 1.55 : cut.top === 'dress' ? 1.32 : cut.top === 'agbada' ? 1.5 : 1.18;
    const r0 = interp(profile, skirtTop) + 0.012;
    const pts: Array<[number, number]> = [];
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      const y = lerp(skirtTop, skirtTo, t);
      const bulge = y > -0.36 ? Math.max(r0, interp(profile, Math.max(y, -0.36)) + 0.012) : r0 * lerp(1.05, flare, (y + 0.36) / (skirtTo + 0.36));
      pts.push([bulge, y]);
    }
    pts.reverse();
    pts.unshift([pts[0][0] * 0.98, skirtTo - 0.004]);
    const skirt = new THREE.Mesh(lathe(pts, seg, sx * (cut.top === 'agbada' ? 1.12 : 1), sz * (cut.top === 'agbada' ? 1.08 : 1.06)), top);
    torso.add(skirt);
    // A hem in the trim colour for the agbada and the gown
    if (detailed && (cut.top === 'agbada' || cut.top === 'gown' || cut.top === 'kaftan')) {
      const rr = pts[1][0];
      const band = new THREE.Mesh(lathe([[rr + 0.003, skirtTo], [rr + 0.003, skirtTo + 0.035]], seg, sx * (cut.top === 'agbada' ? 1.12 : 1), sz * 1.06), trim);
      torso.add(band);
    }
  }
  // The agbada's wide panels over the shoulders and arms, its embroidered front
  if (cut.top === 'agbada') {
    const drape = mat(cut.colour, 0.75, fabric(cut.pattern, cut.colour, cut.accent, 0x111827));
    drape.side = THREE.DoubleSide;
    const tall = 0.36 - (cut.hem - torsoY);
    for (const facing of [0, Math.PI]) {
      const panel = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * breadth, 0.34 * breadth, tall, 18, 4, true, facing - 0.95, 1.9), drape);
      panel.scale.set(1.18, 1, 1.05);
      panel.position.y = 0.36 - tall / 2;
      torso.add(panel);
    }
    if (detailed) {
      // The embroidery: a band round the neck and down the chest, the pocket on the left
      const gold = mat(cut.accent, 0.4, fabric('lace', cut.accent));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.016, 6, 20, Math.PI), gold);
      ring.rotation.set(-0.35, 0, Math.PI);
      ring.scale.set(1, 1.4, 1);
      ring.position.set(0, 0.29, 0.13);
      torso.add(ring);
      const keyhole = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.006), gold);
      keyhole.position.set(0, 0.12, 0.235);
      torso.add(keyhole);
      const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.006), gold);
      pocket.position.set(0.13, 0.02, 0.255);
      torso.add(pocket);
    }
  }
  // Coat, vest, jacket, collar, buttons, pockets
  const frontAt = (y: number) => interp(profile, y) * sz + 0.01;
  if (cut.coat !== undefined) {
    const coat = new THREE.Mesh(lathe([[0.07, 0.34], [0.2, 0.28], [0.205, 0.1], [0.19, -0.1], [0.215, -0.4], [0.24, 0.5 - torsoY], [0.0, 0.5 - torsoY - 0.001]], seg, sx, sz * 1.08), mat(cut.coat, 0.55));
    torso.add(coat);
  }
  if (cut.vest !== undefined) {
    const vest = new THREE.Mesh(lathe(profile.filter(([, y]) => y > -0.3 && y < 0.3).map(([r, y]) => [r + 0.016, y]), seg, sx, sz), mat(cut.vest, 0.5));
    torso.add(vest);
    for (const y of [0.05, -0.12]) {
      const band = new THREE.Mesh(lathe([[interp(profile, y) + 0.02, y - 0.02], [interp(profile, y) + 0.02, y + 0.02]], seg, sx, sz), mat(0xe5e7eb, 0.2, null, 0.5));
      torso.add(band);
    }
  }
  if (cut.top === 'jacket') {
    // Lapels: two dark triangles down the front, the shirt and tie showing between
    const shirt = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.26), mat(0xffffff, 0.6));
    shirt.position.set(0, 0.16, frontAt(0.16) + 0.002);
    torso.add(shirt);
    for (const s of [-1, 1]) {
      const lapel = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.29, 0), new THREE.Vector3(s * 0.11, 0.25, 0), new THREE.Vector3(s * 0.005, 0.02, 0)]), mat(new THREE.Color(cut.colour).multiplyScalar(0.7).getHex(), 0.5));
      lapel.geometry.computeVertexNormals();
      (lapel.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
      lapel.position.z = frontAt(0.16) + 0.006;
      torso.add(lapel);
    }
  }
  if ((cut.collar && cut.top !== 'kaftan') || cut.top === 'jacket') {
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.045, 0.012), cut.top === 'jacket' ? mat(0xffffff, 0.6) : top);
      wing.position.set(s * 0.04, female ? 0.285 : 0.315, frontAt(0.28) - 0.012);
      wing.rotation.set(-0.5, 0, s * 0.5);
      torso.add(wing);
    }
  }
  if (cut.top === 'kaftan' || cut.top === 'buba') {
    // A mandarin band at the neck, an embroidered placket down the chest
    torso.add(new THREE.Mesh(lathe([[0.072, 0.31], [0.07, 0.345]], seg, sx * 0.82, sz * 1.1), trim));
    const placket = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.22), trim);
    placket.position.set(0.035, 0.17, frontAt(0.17) + 0.003);
    torso.add(placket);
  }
  if (cut.buttons && detailed) {
    const btn = mat(cut.top === 'chef' ? 0x111827 : 0xf5f5f4, 0.4);
    const n = cut.top === 'polo' ? 2 : 5;
    for (let i = 0; i < n; i++) {
      const y = 0.26 - i * (cut.top === 'polo' ? 0.05 : 0.085);
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.004, 8), btn);
      b.rotation.x = Math.PI / 2;
      b.position.set(cut.top === 'chef' ? 0.04 : 0, y, frontAt(y) + 0.003);
      torso.add(b);
      if (cut.top === 'chef') {
        const b2 = b.clone();
        b2.position.x = -0.04;
        torso.add(b2);
      }
    }
  }
  if (cut.top === 'jersey' && detailed) {
    // A number on the back, the crest on the chest
    const crest = new THREE.Mesh(new THREE.CircleGeometry(0.022, 12), mat(0xe5b84b, 0.4));
    crest.position.set(0.08, 0.17, frontAt(0.17) + 0.003);
    torso.add(crest);
  }
  if (cut.hood) {
    const hood = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.035, 8, 16, Math.PI * 1.3), top);
    hood.rotation.set(Math.PI / 2 + 0.3, 0, Math.PI * 0.85);
    hood.position.set(0, 0.32, -0.05);
    torso.add(hood);
  }
  if (cut.epaulettes) {
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.01, 0.1), mat(0x111827, 0.4));
      e.position.set(s * (female ? 0.18 : 0.21), 0.29, 0);
      torso.add(e);
      const gold = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.012, 0.012), mat(0xe5b84b, 0.3, null, 0.7));
      gold.position.set(s * (female ? 0.18 : 0.21), 0.296, 0.03);
      torso.add(gold);
    }
  }
  if (config.hasTie || cut.epaulettes || cut.top === 'jacket') {
    const tie = new THREE.Mesh(lathe([[0.0, -0.06], [0.03, -0.03], [0.022, 0.2], [0.012, 0.24], [0, 0.25]], 4, 1, 0.25), mat(config.secondaryColor ?? 0x7f1d1d, 0.5));
    tie.position.set(0, 0.04, frontAt(0.12) + 0.006);
    torso.add(tie);
  }

  // ---------------------------------------------------------------- Head and neck
  const head = new THREE.Group();
  head.position.set(0, female ? 1.56 : 1.64, 0);
  group.add(head);
  const neckR = (female ? 0.05 : 0.061) * (build === 'broad' ? 1.08 : 1);
  const neck = new THREE.Mesh(lathe([[neckR * 0.98, -0.17], [neckR * 1.0, -0.1], [neckR, -0.04], [neckR * 0.98, 0.04]], seg, 1.0, 0.86), skin);
  neck.position.z = -0.008;
  head.add(neck);
  const R = female ? 0.108 : 0.116;
  const C = new THREE.Vector3(0, female ? 0.05 : 0.054, 0.012);
  const skull = new THREE.Mesh(shapeIt(new THREE.SphereGeometry(R, detailed ? 40 : 18, detailed ? 30 : 14), R, shape), skin);
  skull.position.copy(C);
  head.add(skull);
  const face = new THREE.Group();
  face.position.copy(C);
  head.add(face);
  const at = (az: number, ny: number, out = 1) => onHead(R, shape, az, ny, out);
  // Ears
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), skin);
    ear.scale.set(0.42, 1.05, 0.78);
    ear.position.copy(at(s * Math.PI * 0.5, -0.04, 0.98)).add(new THREE.Vector3(0, 0, -0.008));
    ear.rotation.y = s * 0.25;
    face.add(ear);
    if (detailed) {
      const inner = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), skinDeep);
      inner.scale.set(0.3, 0.9, 0.6);
      inner.position.copy(ear.position).add(new THREE.Vector3(s * 0.006, 0, 0.004));
      face.add(inner);
    }
  }
  // Eyes: the white, the iris, the pupil, a glint, the lid over it, the lashes
  const white = mat(0xf4f1ea, 0.2);
  const iris = mat(config.eyeColor ?? 0x3b1f0e, 0.3);
  const pupil = mat(0x050505, 0.1);
  const glint = new THREE.MeshBasicMaterial({ color: 0xffffff });
  materials.push(glint);
  for (const s of [-1, 1]) {
    const eyeAt = at(s * 0.36, 0.0, 0.92);
    const eye = new THREE.Group();
    eye.position.copy(eyeAt);
    eye.rotation.y = s * 0.2;
    face.add(eye);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.0145, detailed ? 14 : 8, detailed ? 10 : 6), white);
    ball.scale.set(1.25, 0.82, 0.7);
    eye.add(ball);
    const ir = new THREE.Mesh(new THREE.CircleGeometry(0.0082, detailed ? 18 : 10), iris);
    ir.position.z = 0.0101;
    eye.add(ir);
    const pu = new THREE.Mesh(new THREE.CircleGeometry(0.004, 10), pupil);
    pu.position.z = 0.0104;
    eye.add(pu);
    if (detailed) {
      const gl = new THREE.Mesh(new THREE.CircleGeometry(0.0016, 6), glint);
      gl.position.set(0.0025, 0.0028, 0.0107);
      eye.add(gl);
    }
    // Upper lid: a skin crescent over the top of the eye, so the eye is almond, not round
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.0158, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), skin);
    lid.scale.set(1.3, 0.9, 0.78);
    lid.position.y = 0.002;
    eye.add(lid);
    const lower = new THREE.Mesh(new THREE.SphereGeometry(0.0152, 12, 8, 0, Math.PI * 2, Math.PI * 0.7, Math.PI * 0.3), skin);
    lower.scale.set(1.28, 0.85, 0.74);
    eye.add(lower);
    if (female && detailed) {
      const lash = new THREE.Mesh(new THREE.TorusGeometry(0.0145, 0.0018, 4, 12, Math.PI * 0.9), dark);
      lash.rotation.z = Math.PI * 0.05;
      lash.scale.set(1.25, 0.75, 1);
      lash.position.set(0, 0.003, 0.004);
      eye.add(lash);
    }
    // The brow: a thick arch of hair above
    const brow = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3([at(s * 0.18, 0.2, 1.02), at(s * 0.34, 0.25, 1.02), at(s * 0.52, 0.21, 1.0)]), 8, female ? 0.0036 : 0.0052, 5, false),
      mat(hairColour, 0.9)
    );
    face.add(brow);
  }
  // The nose: bridge, a broad rounded tip, the wings either side, the nostrils
  const noseW = config.noseWidth ?? (female ? 0.95 : 1.05);
  const bridge = new THREE.Mesh(new THREE.CapsuleGeometry(0.0072, 0.045, 4, 10), skin);
  bridge.scale.set(1, 1, 0.7);
  bridge.position.copy(at(0, -0.14, 0.975));
  bridge.rotation.x = 0.32;
  face.add(bridge);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.0128, 14, 12), skin);
  tip.scale.set(1.3 * noseW, 0.82, 0.92);
  tip.position.copy(at(0, -0.3, 1.035));
  face.add(tip);
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.SphereGeometry(0.0108, 12, 10), skin);
    wing.scale.set(0.9, 0.8, 0.82);
    wing.position.copy(at(s * 0.15 * noseW, -0.315, 0.985));
    face.add(wing);
    if (detailed) {
      const hole = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 6, 4), mat(0x1a0d07, 0.9));
      hole.scale.set(1.2, 0.6, 1);
      hole.position.copy(at(s * 0.07 * noseW, -0.355, 1.02));
      face.add(hole);
    }
  }
  // Lips: the upper with its bow, the fuller lower, the line between
  const lipColour = config.lipColor ?? new THREE.Color(skinHex).multiplyScalar(0.62).lerp(new THREE.Color(female ? 0x7a2a2e : 0x3a1a12), female ? 0.35 : 0.2).getHex();
  const lip = mat(lipColour, female ? 0.35 : 0.5);
  const upperLip = new THREE.Mesh(new THREE.SphereGeometry(0.02, 14, 8), lip);
  upperLip.scale.set(1.55, 0.42, 0.62);
  upperLip.position.copy(at(0, -0.47, 1.0));
  face.add(upperLip);
  const lowerLip = new THREE.Mesh(new THREE.SphereGeometry(0.02, 14, 8), lip);
  lowerLip.scale.set(1.4, 0.52, 0.68);
  lowerLip.position.copy(at(0, -0.53, 0.985));
  face.add(lowerLip);
  if (detailed) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.0016, 0.004), mat(0x1a0b07, 0.9));
    line.position.copy(at(0, -0.5, 1.012));
    face.add(line);
  }
  // A beard on the jaw, the moustache over the lip
  const beard: Beard = female ? 'none' : ((config.beard as Beard | undefined) ?? 'none');
  if (beard !== 'none') {
    const hairMat = mat(hairColour, 0.95, hairGrain(hairColour, 'short'));
    const k = beard === 'stubble' ? 1.008 : 1.02;
    if (beard === 'full' || beard === 'stubble' || beard === 'chinstrap' || beard === 'goatee') {
      const where = (az: number, ny: number) => {
        const a = Math.abs(az);
        if (beard === 'goatee') return ny < -0.56 && a < 0.42 + (ny + 0.56) * -0.4;
        if (beard === 'chinstrap') return ny < -0.45 && a < 1.55 && !(ny > -0.7 && a < 0.5);
        // Down the jaw from the ears, round under the chin; the cheeks above the jawline and the mouth clear
        const jaw = ny < -0.2 - 0.35 * Math.max(0, 1 - a / 1.6);
        const mouth = ny > -0.68 && a < 0.4;
        return a < 1.68 && jaw && !mouth;
      };
      const colour = beard === 'stubble' ? new THREE.Color(hairColour).lerp(new THREE.Color(skinHex), 0.5).getHex() : hairColour;
      face.add(shell(R * k, shape, where, colour, detailed, mat, 'short'));
    }
    if (beard !== 'chinstrap') {
      const mo = new THREE.Mesh(new THREE.CapsuleGeometry(0.0055, 0.036, 4, 8), hairMat);
      mo.rotation.z = Math.PI / 2;
      mo.scale.set(1, 1, 0.6);
      mo.position.copy(at(0, -0.415, 1.025));
      face.add(mo);
    }
  }

  // ---------------------------------------------------------------- Hair and hats
  const { hair, hat } = hairAndHat(config, female);
  buildHair(face, hair, R, shape, hairColour, mat, detailed, hat !== 'none', skinHex);
  if (hat !== 'none') buildHat(face, hat, R, shape, cut, config, mat, detailed);
  if (config.hasShades) {
    const lens = mat(0x0b0b0c, 0.05, null, 0.6);
    for (const s of [-1, 1]) {
      const l = new THREE.Mesh(new THREE.CircleGeometry(0.02, 14), lens);
      l.scale.set(1.35, 0.9, 1);
      l.position.copy(at(s * 0.36, 0.0, 1.06));
      l.rotation.y = s * 0.2;
      face.add(l);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.004, 0.004), mat(0xd4af37, 0.3, null, 0.8));
    bar.position.copy(at(0, 0.06, 1.08));
    face.add(bar);
  }
  // Round the neck
  if (config.hasGoldChain) {
    const chain = new THREE.Mesh(new THREE.TorusGeometry(neckR * 1.5, 0.006, 6, 28), mat(0xe5b84b, 0.2, null, 0.95));
    chain.rotation.x = Math.PI / 2 + 0.35;
    chain.position.set(0, -0.15, 0.025);
    head.add(chain);
  }
  if (config.hasCoralBeads) {
    const beads = new THREE.Mesh(new THREE.TorusGeometry(neckR * 1.4, 0.013, 8, 30), mat(0xc2410c, 0.3));
    beads.rotation.x = Math.PI / 2 + 0.2;
    beads.position.set(0, -0.13, 0.01);
    head.add(beads);
  }
  if (config.hasStethoscope) {
    const tube = new THREE.Mesh(new THREE.TorusGeometry(neckR * 1.6, 0.007, 6, 24, Math.PI * 1.4), mat(0x111827, 0.4));
    tube.rotation.set(Math.PI / 2 + 0.5, 0, Math.PI * 0.8);
    tube.position.set(0, -0.17, 0.02);
    head.add(tube);
  }

  // ---------------------------------------------------------------- Arms
  const shoulderX = (female ? 0.24 : 0.32) * (build === 'slim' ? 0.95 : build === 'broad' ? 1.06 : 1);
  const upperLen = female ? 0.28 : 0.32;
  const foreLen = female ? 0.26 : 0.3;
  const armR = (female ? 0.05 : 0.064) * breadth;
  const sleeveMat = cut.top === 'agbada' || cut.top === 'kaftan' || cut.top === 'buba' ? top : cut.top === 'overall' && cut.sleeves === 'none' ? skin : top;
  const coatMat = cut.coat !== undefined ? mat(cut.coat, 0.55) : null;
  const makeArm = (side: -1 | 1) => {
    const arm = new THREE.Group();
    arm.position.set(side * shoulderX, female ? 1.3 : 1.38, 0);
    group.add(arm);
    const sleeveLen = cut.sleeves === 'none' ? 0 : cut.sleeves === 'short' ? upperLen * 0.5 : upperLen;
    const ease = cut.sleeves === 'wide' ? 0.06 : 0.012;
    // The shoulder's round
    const deltoid = new THREE.Mesh(new THREE.SphereGeometry(armR * 1.08 + (sleeveLen ? Math.min(ease, 0.014) * 0.6 : 0), seg / 2, seg / 3), sleeveLen ? (coatMat ?? sleeveMat) : skin);
    deltoid.scale.set(0.95, 1.0, 0.92);
    deltoid.position.set(-side * 0.016, -0.035, 0);
    arm.add(deltoid);
    if (sleeveLen > 0) {
      // The sleeve: from the shoulder down to its hem, a little loose; wide for the agbada
      const hemR = (sleeveLen >= upperLen ? armR * 0.9 : armR * 1.04) + ease * (cut.sleeves === 'wide' ? 1.6 : 1);
      const sleeve = new THREE.Mesh(lathe([[hemR * 0.96, -sleeveLen - 0.004], [hemR, -sleeveLen], [armR * 1.08 + ease, -sleeveLen * 0.4], [armR * 1.06 + ease, -0.02], [0, -0.01]], seg / 2), coatMat ?? sleeveMat);
      arm.add(sleeve);
    }
    if (sleeveLen < upperLen) arm.add(new THREE.Mesh(lathe([[armR * 0.88, -upperLen], [armR * 1.08, -upperLen * 0.35], [armR * 1.15, -sleeveLen + 0.01]], seg / 2), skin));
    const fore = new THREE.Group();
    fore.position.y = -upperLen;
    arm.add(fore);
    fore.add(new THREE.Mesh(new THREE.SphereGeometry(armR * 0.92 + (cut.sleeves === 'long' || cut.sleeves === 'wide' ? ease : 0), seg / 2, seg / 3), cut.sleeves === 'long' || cut.sleeves === 'wide' ? (coatMat ?? sleeveMat) : skin));
    const forePts: Array<[number, number]> = [[armR * 0.66, -foreLen], [armR * 0.95, -foreLen * 0.45], [armR * 0.92, 0]];
    if (cut.sleeves === 'long' || cut.sleeves === 'wide') {
      const wide = cut.sleeves === 'wide';
      fore.add(new THREE.Mesh(lathe(forePts.map(([r, y], i) => [wide ? r + ease * (1 + (2 - i) * 0.8) : r + ease, y] as [number, number]), seg / 2), coatMat ?? sleeveMat));
      if (detailed) fore.add(new THREE.Mesh(lathe([[armR * 0.7 + ease + 0.002, -foreLen + 0.002], [armR * 0.72 + ease + 0.002, -foreLen + 0.03]], seg / 2), wide ? trim : coatMat ?? sleeveMat));
    } else {
      fore.add(new THREE.Mesh(lathe(forePts, seg / 2), skin));
    }
    // The hand: a palm, four fingers, a thumb
    const hand = new THREE.Group();
    hand.position.y = -foreLen - 0.005;
    fore.add(hand);
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), skin);
    palm.scale.set(female ? 0.9 : 1, 1.3, 0.55);
    palm.position.y = -0.04;
    hand.add(palm);
    if (detailed) {
      for (let f = 0; f < 4; f++) {
        const finger = new THREE.Mesh(new THREE.CapsuleGeometry(female ? 0.0068 : 0.0078, female ? 0.042 : 0.048, 3, 6), skin);
        finger.position.set((f - 1.5) * (female ? 0.0145 : 0.0165), -0.098 + Math.abs(f - 1.5) * 0.006, 0.004);
        finger.rotation.x = -0.18;
        hand.add(finger);
      }
      const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.0085, 0.032, 3, 6), skin);
      thumb.position.set(side * -0.03, -0.05, 0.014);
      thumb.rotation.set(-0.5, 0, side * 0.7);
      hand.add(thumb);
    } else {
      const mitt = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.03, 3, 6), skin);
      mitt.scale.set(1, 1, 0.55);
      mitt.position.y = -0.09;
      hand.add(mitt);
    }
    return { arm, fore, hand };
  };
  const L = makeArm(-1);
  const Rt = makeArm(1);

  // The phone in the right hand, for calls
  const phoneMesh = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.07, 0.008), mat(0x111827, 0.3, null, 0.4));
  phoneMesh.position.set(0, -foreLen - 0.06, 0.03);
  phoneMesh.visible = false;
  Rt.fore.add(phoneMesh);
  if (config.hasTray) {
    const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.015, 18), mat(0xd1d5db, 0.3, null, 0.6));
    tray.position.set(0, -foreLen - 0.02, 0.12);
    Rt.fore.add(tray);
  }

  // ---------------------------------------------------------------- Legs
  const hipY = female ? 0.74 : 0.78;
  const thighLen = female ? 0.38 : 0.4;
  const shinLen = female ? 0.36 : 0.38;
  const legX = female ? 0.13 : 0.16;
  const legR = (female ? 0.072 : 0.088) * breadth;
  // What covers each part of the leg: trousers all the way, shorts to above the knee, skirts and dresses leave them bare
  const covered = cut.bottom === 'trousers' || cut.bottom === 'jeans' || cut.bottom === 'joggers';
  const shorts = cut.bottom === 'shorts';
  const wrapper = cut.bottom === 'wrapper';
  const legEase = cut.bottom === 'joggers' ? 0.014 : cut.bottom === 'jeans' ? 0.006 : 0.012;
  const makeLeg = (side: -1 | 1) => {
    const leg = new THREE.Group();
    leg.position.set(side * legX, hipY, 0);
    group.add(leg);
    const thighPts: Array<[number, number]> = [[legR * 0.78, -thighLen], [legR * 0.95, -thighLen * 0.55], [legR * 1.08, -0.04], [legR * 1.1, 0.02]];
    if (covered || wrapper) leg.add(new THREE.Mesh(lathe(thighPts.map(([r, y]) => [r + legEase, y] as [number, number]), seg / 2), bottom));
    else if (shorts) {
      leg.add(new THREE.Mesh(lathe(thighPts.filter(([, y]) => y > -thighLen * 0.6).map(([r, y]) => [r + 0.02, y] as [number, number]).concat([[legR + 0.02, -thighLen * 0.58]]).sort((a, b) => a[1] - b[1]), seg / 2), bottom));
      leg.add(new THREE.Mesh(lathe(thighPts.filter(([, y]) => y < -thighLen * 0.5), seg / 2), skin));
    } else leg.add(new THREE.Mesh(lathe(thighPts, seg / 2), skin));
    const lower = new THREE.Group();
    lower.position.y = -thighLen;
    leg.add(lower);
    const kneeMat = covered || wrapper ? bottom : skin;
    lower.add(new THREE.Mesh(new THREE.SphereGeometry(legR * 0.8 + (covered ? legEase : 0), seg / 2, seg / 3), kneeMat));
    const shinPts: Array<[number, number]> = [[legR * 0.5, -shinLen + 0.06], [legR * 0.62, -shinLen * 0.62], [legR * 0.82, -shinLen * 0.25], [legR * 0.8, 0]];
    lower.add(new THREE.Mesh(lathe(covered || wrapper ? shinPts.map(([r, y], i) => [(cut.bottom === 'jeans' ? r : Math.max(r, legR * 0.7)) + legEase + (i === 0 ? 0.006 : 0), y] as [number, number]) : shinPts, seg / 2), covered || wrapper ? bottom : skin));
    const shoe = buildShoe(config, female, cut, mat, detailed);
    shoe.position.y = -shinLen;
    lower.add(shoe);
    return { leg, lower };
  };
  const LL = makeLeg(-1);
  const RL = makeLeg(1);
  // A skirt or a wrapper round the hips and thighs
  if (cut.bottom === 'skirt' || wrapper) {
    const hemY = wrapper ? 0.08 : 0.46;
    const s = new THREE.Mesh(lathe([[0.0, hemY - 0.002], [0.2 + (wrapper ? 0.01 : 0.03), hemY], [0.205, (hemY + hipY) / 2], [0.2, hipY], [0.19, hipY + 0.05], [0, hipY + 0.05]], seg, 1.1, 0.95), bottom);
    group.add(s);
  }

  // ---------------------------------------------------------------- Bags
  if (config.bagStyle && config.bagStyle !== 'none' || config.hasBackpack) {
    const style = config.hasBackpack ? 'backpack' : config.bagStyle;
    const bagMat = mat(config.bagColor ?? 0x7c2d12, 0.45, fabric('leather', config.bagColor ?? 0x7c2d12));
    if (style === 'backpack') {
      const pack = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.36, 0.13), bagMat);
      pack.position.set(0, 0.06, -0.21);
      torso.add(pack);
    } else if (style === 'crossbody' || style === 'clutch') {
      const bag = new THREE.Mesh(new THREE.BoxGeometry(style === 'clutch' ? 0.2 : 0.18, 0.13, 0.05), bagMat);
      bag.position.set(0.19, -0.24, 0.09);
      torso.add(bag);
      if (style === 'crossbody') {
        const strap = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.006, 4, 30, Math.PI), bagMat);
        strap.rotation.set(0, 0, -0.8);
        strap.position.set(0.02, 0.0, 0.16);
        torso.add(strap);
      }
    } else if (style === 'briefcase') {
      const bag = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.07), bagMat);
      bag.position.set(0, -foreLen - 0.2, 0);
      L.fore.add(bag);
    }
  }

  const tag = nameTag(config.username);
  tag.position.set(0, female ? 2.02 : 2.14, 0);
  group.add(tag);

  // The same motions the game's people have always had: idle, walk, run, dance, talk, a call
  const updateAnimation = (time: number, state?: boolean | string) => {
    const walking = state === true || state === 'walk';
    const running = state === 'run';
    const dancing = state === 'dance';
    const talking = state === 'talk';
    const calling = state === 'phone_call' || state === 'call';
    phoneMesh.visible = calling;
    const set = (g: THREE.Object3D, x: number, y = 0, z = 0) => g.rotation.set(x, y, z);
    if (running || walking) {
      const f = running ? 14 : 8;
      const stride = Math.sin(time * f);
      const a = running ? 0.95 : 0.58;
      set(LL.leg, stride * a); set(RL.leg, -stride * a);
      set(LL.lower, Math.max(0, -stride * (running ? 1.1 : 0.75))); set(RL.lower, Math.max(0, stride * (running ? 1.1 : 0.75)));
      set(L.arm, -stride * (running ? 0.85 : 0.48), 0, running ? -0.25 : 0); set(Rt.arm, stride * (running ? 0.85 : 0.48), 0, running ? 0.25 : 0);
      set(L.fore, running ? -0.9 + stride * 0.25 : -0.28 + Math.max(0, -stride * 0.35)); set(Rt.fore, running ? -0.9 - stride * 0.25 : -0.28 + Math.max(0, stride * 0.35));
      torso.position.y = torsoY + Math.abs(Math.sin(time * f * 2)) * (running ? 0.08 : 0.034);
      set(torso, running ? 0.14 : 0, 0, stride * (running ? 0.04 : 0.025));
      set(head, running ? -0.06 : 0);
    } else if (dancing) {
      const beat = time * 8;
      const bounce = Math.abs(Math.sin(beat)) * 0.08;
      torso.position.y = torsoY - bounce;
      set(torso, 0.04, Math.cos(beat * 0.5) * 0.12, Math.sin(beat * 0.5) * 0.15);
      set(L.arm, -0.8 + Math.sin(beat) * 0.35, 0, -0.35 + Math.sin(beat * 0.5) * 0.22);
      set(Rt.arm, -0.8 + Math.cos(beat) * 0.35, 0, 0.35 - Math.cos(beat * 0.5) * 0.22);
      set(L.fore, -0.75 + Math.sin(beat) * 0.3); set(Rt.fore, -0.75 + Math.cos(beat) * 0.3);
      set(head, Math.sin(beat) * 0.08, Math.sin(beat * 0.5) * 0.16);
      set(LL.leg, Math.sin(beat * 0.5) * 0.2); set(RL.leg, -Math.sin(beat * 0.5) * 0.2);
      set(LL.lower, bounce * 3.5); set(RL.lower, bounce * 3.5);
    } else if (calling) {
      torso.position.y = torsoY + Math.sin(time * 2) * 0.012;
      set(torso, 0);
      set(Rt.arm, -0.85, 0.25, 0.45); set(Rt.fore, -1.45);
      set(L.arm, Math.sin(time * 2) * 0.04); set(L.fore, -0.15);
      set(head, Math.sin(time * 2.5) * 0.05, 0, -0.1);
      for (const g of [LL.leg, RL.leg, LL.lower, RL.lower]) set(g, 0);
    } else if (talking) {
      const g = Math.sin(time * 4);
      torso.position.y = torsoY + Math.sin(time * 2) * 0.015;
      set(torso, 0);
      set(L.arm, -0.35 + g * 0.15, 0, -0.15); set(L.fore, -0.55 + g * 0.2);
      set(Rt.arm, -0.55 + Math.cos(time * 3) * 0.2, 0, 0.2); set(Rt.fore, -0.75 + Math.cos(time * 3) * 0.25);
      set(head, Math.sin(time * 3) * 0.08, Math.sin(time * 1.5) * 0.12);
      for (const q of [LL.leg, RL.leg, LL.lower, RL.lower]) set(q, 0);
    } else {
      const breath = Math.sin(time * 2) * 0.01;
      torso.position.y = torsoY + breath;
      set(torso, 0); set(head, 0);
      set(L.arm, Math.sin(time * 2) * 0.025, 0, -0.03); set(Rt.arm, -Math.sin(time * 2) * 0.025, 0, 0.03);
      set(L.fore, -0.12); set(Rt.fore, -0.12);
      for (const q of [LL.leg, RL.leg, LL.lower, RL.lower]) set(q, 0);
    }
  };

  // Few draw calls: each joint's pieces of one material made into one mesh
  mergeParts(group, new Set<THREE.Object3D>([phoneMesh, shadow, tag]));
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m !== shadow) m.castShadow = detailed;
  });
  if (config.heightScale) group.scale.setScalar(config.heightScale);

  return {
    group,
    gender: config.gender,
    username: config.username,
    nameTag: tag,
    head,
    torso,
    leftArm: L.arm,
    rightArm: Rt.arm,
    leftLeg: LL.leg,
    rightLeg: RL.leg,
    materials,
    updateAnimation,
    phoneMesh,
    leftForearm: L.fore,
    rightForearm: Rt.fore,
    leftLowerLeg: LL.lower,
    rightLowerLeg: RL.lower,
  };
}

const MASKS = new Map<string, THREE.Texture>();

/**
 * A shell over the head (a beard, a cut of hair) whose edge follows a line drawn on a fine mask,
 * so the edge is smooth: `where` says, for a point at azimuth `az` (0 = the front) and height `ny`
 * (-1 chin .. 1 crown), whether it is covered. A fade lightens toward the skin colour `fadeTo`
 * down the sides. Far-off people (street detail) are cut by their triangles, which costs nothing.
 */
function shell(r: number, shape: HeadShape, where: (az: number, ny: number) => boolean, colour: number, detailed: boolean, mat: MatMaker, kind: 'short' | 'coily' | 'waves' | 'straight', fadeTo?: number, front = 0.5): THREE.Mesh {
  if (!detailed || typeof document === 'undefined') {
    const geo = shapeIt(new THREE.SphereGeometry(r, 22, 16), r, shape);
    cutBelow(geo, (x, y, z) => where(Math.atan2(x, z), y / r));
    return new THREE.Mesh(geo, mat(fadeTo !== undefined ? new THREE.Color(colour).lerp(new THREE.Color(fadeTo), 0.25).getHex() : colour, 0.92, hairGrain(colour, kind)));
  }
  const geo = shapeIt(new THREE.SphereGeometry(r, 48, 36), r, shape);
  const key = `${where.toString().length}:${front}:${colour}:${fadeTo ?? ''}:${kind}:${where(0, 0.3)}${where(1.5, -0.3)}${where(3, -0.3)}${where(0, -0.7)}`;
  let map = MASKS.get(key);
  if (!map) {
    const W = 512;
    const H = 256;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(W, H);
    const base = new THREE.Color(colour);
    const skinTo = fadeTo !== undefined ? new THREE.Color(fadeTo) : null;
    let seed = colour + 17;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
    for (let y = 0; y < H; y++) {
      // The sphere's v runs from the crown (canvas top) to the chin; u round from the back, the front a quarter of the way
      const theta = ((y + 0.5) / H) * Math.PI;
      const ny = Math.cos(theta);
      for (let x = 0; x < W; x++) {
        const phi = ((x + 0.5) / W) * Math.PI * 2;
        const az = Math.atan2(-Math.cos(phi), Math.sin(phi));
        const i = (y * W + x) * 4;
        const on = where(az, ny);
        let c = base;
        if (skinTo && on) {
          // The fade: dark on top, down to the skin over the ears and the nape
          const t = smooth(0.2, 0.66, ny + Math.max(0, Math.abs(az) / Math.PI - 0.15) * 0.25);
          c = skinTo.clone().lerp(base, 0.12 + t * 0.88);
        }
        // Into the picture's own colours (the texture is sRGB), with a speck of grain
        const out = c.clone().convertLinearToSRGB();
        const speck = (rnd() - 0.5) * (kind === 'coily' ? 0.18 : 0.12);
        img.data[i] = Math.max(0, Math.min(255, (out.r + speck) * 255));
        img.data[i + 1] = Math.max(0, Math.min(255, (out.g + speck) * 255));
        img.data[i + 2] = Math.max(0, Math.min(255, (out.b + speck) * 255));
        img.data[i + 3] = on ? 255 : 0;
      }
    }
    ctx.putImageData(img, 0, 0);
    map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    MASKS.set(key, map);
  }
  const m = mat(0xffffff, kind === 'straight' ? 0.45 : 0.9, map);
  m.alphaTest = 0.5;
  return new THREE.Mesh(geo, m);
}

/**
 * Every group's own meshes that share a material become one mesh: a person is a few dozen draw
 * calls, not a few hundred. Groups (the joints) are kept as they are, so they still move.
 */
function mergeParts(root: THREE.Object3D, keep: Set<THREE.Object3D>): void {
  const groups: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) groups.push(o);
  });
  for (const g of groups) {
    const byMaterial = new Map<THREE.Material, THREE.Mesh[]>();
    for (const child of g.children) {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || keep.has(mesh) || mesh.children.length || Array.isArray(mesh.material) || !mesh.visible) continue;
      const geo = mesh.geometry;
      if (!geo.getAttribute('normal') || !geo.getAttribute('uv')) continue;
      const list = byMaterial.get(mesh.material) ?? [];
      list.push(mesh);
      byMaterial.set(mesh.material, list);
    }
    for (const [material, meshes] of byMaterial) {
      if (meshes.length < 2) continue;
      const parts = meshes.map((mesh) => {
        mesh.updateMatrix();
        const geo = (mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()).applyMatrix4(mesh.matrix);
        for (const name of Object.keys(geo.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') geo.deleteAttribute(name);
        return geo;
      });
      const merged = mergeGeometries(parts, false);
      if (!merged) continue;
      for (const mesh of meshes) {
        g.remove(mesh);
        mesh.geometry.dispose();
      }
      for (const part of parts) part.dispose();
      const one = new THREE.Mesh(merged, material);
      one.name = `${g.name || 'part'} merged`;
      g.add(one);
    }
  }
}

/** The radius of the torso's profile at a height, between its points */
function interp(profile: Array<[number, number]>, y: number): number {
  for (let i = 1; i < profile.length; i++) {
    const [r0, y0] = profile[i - 1];
    const [r1, y1] = profile[i];
    if (y >= y0 && y <= y1) return lerp(r0, r1, (y - y0) / (y1 - y0 || 1));
  }
  return y < profile[0][1] ? profile[0][0] : profile[profile.length - 1][0];
}

type MatMaker = (colour: number | string, rough?: number, map?: THREE.Texture | null, metal?: number) => THREE.MeshStandardMaterial;

/** The hair, built on the head of the shape chosen: low cuts and fades, waves, afros, twists, locs, cornrows, braids, buns, wigs */
function buildHair(face: THREE.Group, style: string, R: number, shape: HeadShape, colour: number, mat: MatMaker, detailed: boolean, underHat: boolean, skinHex = '#6b4430'): void {
  if (style === 'bald') return;
  const grain = (kind: 'short' | 'coily' | 'waves' | 'straight') => {
    const m = mat(colour, kind === 'straight' ? 0.45 : 0.92, hairGrain(colour, kind));
    m.userData.kind = kind;
    return m;
  };
  const segs = detailed ? 44 : 20;
  /** A shell of hair over the skull above the hairline: high at the forehead, down at the temples, low at the nape */
  /** A shell of hair over the skull above the hairline: high at the forehead, down at the temples, low at the nape */
  const cap = (k: number, front: number, side: number, back: number, m: THREE.MeshStandardMaterial, fadeTo?: number) => {
    const inside = (az: number, ny: number) => {
      const a = Math.abs(az) / Math.PI;
      // From the front of the head (a = 0) round to the back (a = 1)
      const line = a < 0.5 ? lerp(front, side, smooth(0, 0.5, a)) : lerp(side, back, smooth(0.5, 1, a));
      // Not over the ears
      const ear = Math.abs(Math.abs(az) - Math.PI / 2) < 0.3 && ny < side + 0.2;
      return ny > line && !ear;
    };
    const kind = (m.userData.kind as 'short' | 'coily' | 'waves' | 'straight' | undefined) ?? 'short';
    const mesh = shell(R * k, shape, inside, m.color.getHex(), detailed, mat, kind, fadeTo, front);
    face.add(mesh);
    return mesh;
  };
  const hairline = { front: 0.5, side: 0.12, back: -0.42 };
  if (underHat) {
    cap(1.012, 0.45, 0.1, -0.4, grain('short'));
    return;
  }
  switch (style) {
    case 'low_cut':
    case 'short_crop':
      cap(1.014, hairline.front, hairline.side, hairline.back, grain('short'));
      return;
    case 'buzz':
      cap(1.008, hairline.front, hairline.side, hairline.back, mat(new THREE.Color(colour).lerp(new THREE.Color(0x3b2a20), 0.35).getHex(), 0.95, hairGrain(colour, 'short')));
      return;
    case 'waves':
      cap(1.018, hairline.front, hairline.side, hairline.back, grain('waves'));
      return;
    case 'fade': {
      // Full on top, the sides taken down to the skin
      cap(1.02, hairline.front, hairline.side, hairline.back, grain('short'), new THREE.Color(skinHex).getHex());
      return;
    }
    case 'high_top': {
      cap(1.01, hairline.front, hairline.side, hairline.back, grain('short'));
      const block = new THREE.Mesh(lathe([[0, R * 1.45], [R * 0.62, R * 1.42], [R * 0.72, R * 1.1], [R * 0.74, R * 0.6], [0.0, R * 0.55]], segs, 1.0, 0.95), grain('coily'));
      face.add(block);
      return;
    }
    case 'afro': {
      cap(1.012, hairline.front, hairline.side, hairline.back, grain('coily'));
      const big = new THREE.SphereGeometry(R * 1.62, detailed ? 34 : 16, detailed ? 26 : 12);
      // A soft, round, slightly uneven puff
      const pos = big.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
        const n = 1 + Math.sin(v.x * 38 + 1.3) * Math.sin(v.y * 33) * Math.sin(v.z * 29 + 0.7) * 0.025;
        pos.setXYZ(i, v.x * n * 1.06, v.y * n * 0.94, v.z * n);
      }
      big.translate(0, R * 0.42, -R * 0.12);
      // Open over the face, down to the forehead
      cutBelow(big, (x, y, z) => {
        const az = Math.atan2(x, z);
        const ny = (y - R * 0.42) / (R * 1.55);
        return !(Math.abs(az) < 0.9 && ny < 0.05) && ny > -0.62;
      });
      big.computeVertexNormals();
      face.add(new THREE.Mesh(big, grain('coily')));
      return;
    }
    case 'twists':
    case 'bantu_knots': {
      cap(1.012, hairline.front, hairline.side, hairline.back, grain('coily'));
      const parts: THREE.BufferGeometry[] = [];
      const knots = style === 'bantu_knots';
      const n = knots ? 9 : detailed ? 46 : 20;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const ny = knots ? 0.35 + (i % 3) * 0.2 : 0.18 + (1 - Math.sqrt(t)) * 0.78;
        const az = knots ? (i / n) * Math.PI * 2 : i * 2.399;
        const p = onHead(R, shape, az, Math.min(0.95, ny), 1.0);
        const g = knots ? new THREE.SphereGeometry(0.026, 10, 8) : new THREE.CapsuleGeometry(0.0095, 0.038, 3, 6);
        // Twists lie out and down from the scalp, as they fall; knots sit up
        const up = knots ? p.clone().normalize() : p.clone().normalize().add(new THREE.Vector3(0, -0.9, 0)).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
        g.applyQuaternion(q);
        const lift = knots ? 0.02 : 0.016;
        g.translate(p.x + p.x * 0.12 + up.x * lift, p.y + up.y * lift, p.z + p.z * 0.12 + up.z * lift);
        parts.push(g.index ? g.toNonIndexed() : g);
      }
      face.add(new THREE.Mesh(mergeGeometries(parts), grain('coily')));
      return;
    }
    case 'dreads':
    case 'locs': {
      cap(1.012, hairline.front, hairline.side, hairline.back, grain('coily'));
      const parts: THREE.BufferGeometry[] = [];
      const n = detailed ? 40 : 18;
      for (let i = 0; i < n; i++) {
        const az = (i / n) * Math.PI * 2;
        // Not hanging over the face
        if (Math.abs(Math.atan2(Math.sin(az), Math.cos(az))) < 0.8) continue;
        const root = onHead(R, shape, az, 0.45, 1.0);
        const len = 0.2 + ((i * 37) % 10) / 70;
        const g = new THREE.CylinderGeometry(0.011, 0.008, len, 6);
        g.translate(0, -len / 2, 0);
        const out = new THREE.Vector3(root.x, 0, root.z).normalize();
        g.applyQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(-out.z, 0, out.x), -0.18));
        g.translate(root.x + out.x * 0.01, root.y, root.z + out.z * 0.01);
        parts.push(g.index ? g.toNonIndexed() : g);
      }
      face.add(new THREE.Mesh(mergeGeometries(parts), grain('coily')));
      return;
    }
    case 'cornrows': {
      cap(1.008, hairline.front, hairline.side, hairline.back, grain('short'));
      const parts: THREE.BufferGeometry[] = [];
      for (let i = -3; i <= 3; i++) {
        const az = i * 0.32;
        // From the forehead over the crown to the nape: up the front, then down the back
        const pts: THREE.Vector3[] = [];
        for (let k = 0; k <= 10; k++) {
          const a = k < 5 ? az : Math.PI - az;
          const yy = k < 5 ? lerp(0.5, 0.98, k / 5) : lerp(0.98, -0.4, (k - 5) / 5);
          pts.push(onHead(R, shape, a, yy, 1.022));
        }
        parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.009, 5, false).toNonIndexed());
      }
      face.add(new THREE.Mesh(mergeGeometries(parts), grain('coily')));
      return;
    }
    case 'box_braids':
    case 'braids': {
      cap(1.014, 0.45, 0.08, -0.45, grain('coily'));
      const parts: THREE.BufferGeometry[] = [];
      const n = detailed ? 44 : 20;
      for (let i = 0; i < n; i++) {
        const az = Math.PI * 0.42 + (i / (n - 1)) * Math.PI * 1.16;
        const root = onHead(R, shape, az, 0.25 + ((i * 13) % 5) * 0.06, 1.01);
        const len = 0.42 + ((i * 29) % 7) / 60;
        const g = new THREE.CylinderGeometry(0.009, 0.007, len, 5);
        g.translate(0, -len / 2, 0);
        const out = new THREE.Vector3(root.x, 0, root.z).normalize();
        g.applyQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(-out.z, 0, out.x), -0.12));
        g.translate(root.x + out.x * 0.012, root.y, root.z + out.z * 0.012);
        parts.push(g.index ? g.toNonIndexed() : g);
      }
      face.add(new THREE.Mesh(mergeGeometries(parts), grain('coily')));
      return;
    }
    case 'bun':
    case 'ponytail': {
      cap(1.016, 0.48, 0.1, -0.3, grain('straight'));
      if (style === 'bun') {
        const bun = new THREE.Mesh(new THREE.SphereGeometry(R * 0.42, 14, 10), grain('coily'));
        bun.position.copy(onHead(R, shape, Math.PI, 0.62, 1.12));
        face.add(bun);
      } else {
        const tail = new THREE.Mesh(lathe([[0.0, -0.24], [0.02, -0.2], [0.035, -0.08], [0.03, 0.0], [0.0, 0.01]], 10), grain('straight'));
        tail.position.copy(onHead(R, shape, Math.PI, 0.3, 1.05));
        tail.rotation.x = 0.25;
        face.add(tail);
      }
      return;
    }
    case 'bob_wig':
    case 'long_wig': {
      const long = style === 'long_wig';
      // The wig over the crown and down the sides and back, open for the face, a fringe across
      const geo = shapeIt(new THREE.SphereGeometry(R * 1.06, segs, Math.round(segs * 0.75)), R * 1.06, shape);
      cutBelow(geo, (x, y, z) => {
        const ny = y / (R * 1.06);
        const az = Math.atan2(x, z);
        const faceHole = Math.abs(az) < 0.95 && ny < 0.42;
        return !faceHole && ny > -0.62;
      });
      face.add(new THREE.Mesh(geo, grain('straight')));
      const fall = new THREE.Mesh(lathe([[0.0, long ? -0.4 : -0.11], [R * 1.0, long ? -0.4 : -0.11], [R * 1.08, -0.05], [R * 1.06, 0.0], [0, 0.0]], segs, 1.0, 0.92), grain('straight'));
      fall.position.z = -0.012;
      // Only behind and at the sides
      cutBelow(fall.geometry, (x, _y, z) => z < R * 0.35 || Math.abs(x) > R * 0.8);
      face.add(fall);
      const fringe = new THREE.Mesh(new THREE.SphereGeometry(R * 1.07, 20, 10, -Math.PI * 0.3, Math.PI * 0.6, Math.PI * 0.18, Math.PI * 0.22), grain('straight'));
      face.add(fringe);
      return;
    }
    default:
      cap(1.014, hairline.front, hairline.side, hairline.back, grain('short'));
  }
}

/** Hats over the hair: the fila, the gele, a cap, the uniform caps, the chef's toque */
function buildHat(face: THREE.Group, hat: Hat, R: number, shape: HeadShape, cut: Cut, config: HumanConfig, mat: MatMaker, detailed: boolean): void {
  const seg = detailed ? 28 : 14;
  const crown = onHead(R, shape, 0, 1, 1).y;
  const colour = config.hatColor ?? (hat === 'gele' ? cut.colour : config.secondaryColor ?? 0xf5f0e1);
  switch (hat) {
    case 'fila': {
      // The Yoruba cap: a soft tall crown folded over to one side
      const cloth = mat(colour, 0.8, fabric('aso_oke', colour, new THREE.Color(colour).multiplyScalar(0.8).getHex()));
      const f = new THREE.Mesh(lathe([[R * 0.9, 0], [R * 0.93, R * 0.35], [R * 0.86, R * 0.7], [R * 0.45, R * 0.86], [0, R * 0.88]], seg, 1.0, 1.08), cloth);
      f.position.y = crown - R * 0.4;
      f.rotation.z = -0.22;
      f.position.x = R * 0.05;
      face.add(f);
      return;
    }
    case 'gele': {
      // The headtie: a broad wrap round the head and a fan of stiff pleats rising behind
      const cloth = mat(colour, 0.5, fabric(cut.pattern === 'plain' ? 'aso_oke' : cut.pattern, colour, cut.accent));
      for (let i = 0; i < 4; i++) {
        const t = new THREE.Mesh(new THREE.TorusGeometry(R * (1.02 + i * 0.07), R * 0.24, 8, seg), cloth);
        t.rotation.x = Math.PI / 2 - 0.42;
        t.position.set(0, crown - R * 0.62 + i * R * 0.22, -R * 0.12 - i * R * 0.05);
        face.add(t);
      }
      cloth.side = THREE.DoubleSide;
      for (let p = 0; p < 11; p++) {
        const a = -1.35 + p * 0.27;
        const pleat = new THREE.Mesh(new THREE.ConeGeometry(R * 0.5, R * 1.7, 4, 1, true), cloth);
        pleat.scale.set(1, 1, 0.2);
        pleat.position.set(Math.sin(a) * R * 0.95, crown + R * 0.45, -R * 0.5 + Math.cos(a) * R * 0.25);
        pleat.rotation.set(-0.62, 0, -a * 0.75);
        face.add(pleat);
      }
      return;
    }
    case 'cap':
    case 'beret': {
      const m = mat(colour, 0.7);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(R * 1.06, seg, seg / 2, 0, Math.PI * 2, 0, Math.PI * 0.5), m);
      dome.scale.set(hat === 'beret' ? 1.15 : 1.0, hat === 'beret' ? 0.55 : 0.82, 1.05);
      dome.position.y = crown - R * 0.72;
      if (hat === 'beret') dome.rotation.z = -0.25;
      face.add(dome);
      if (hat === 'cap') {
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.7, R * 0.7, 0.008, 16, 1, false, -Math.PI / 2, Math.PI), m);
        brim.scale.set(1, 1, 0.9);
        brim.position.set(0, crown - R * 0.7, R * 0.88);
        face.add(brim);
      }
      return;
    }
    case 'hardhat': {
      const m = mat(0xfacc15, 0.35);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(R * 1.12, seg, seg / 2, 0, Math.PI * 2, 0, Math.PI * 0.5), m);
      dome.position.y = crown - R * 0.78;
      face.add(dome);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.32, R * 1.32, 0.012, seg), m);
      brim.position.y = crown - R * 0.78;
      face.add(brim);
      return;
    }
    case 'police_cap':
    case 'pilot_cap': {
      const pilot = hat === 'pilot_cap';
      const body = mat(pilot ? 0x111827 : 0x1e293b, 0.5);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.2, R * 1.0, R * 0.55, seg), body);
      top.position.y = crown - R * 0.25;
      face.add(top);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.01, R * 1.01, R * 0.14, seg), mat(pilot ? 0xe5b84b : 0x111827, 0.3, null, pilot ? 0.7 : 0));
      band.position.y = crown - R * 0.42;
      face.add(band);
      const visor = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.72, R * 0.72, 0.008, 16, 1, false, -Math.PI / 2, Math.PI), mat(0x050505, 0.2));
      visor.position.set(0, crown - R * 0.5, R * 0.86);
      visor.rotation.x = 0.2;
      face.add(visor);
      return;
    }
    case 'chef_toque': {
      const m = mat(0xffffff, 0.8);
      const t = new THREE.Mesh(lathe([[R * 0.98, 0], [R * 1.0, R * 0.3], [R * 1.25, R * 1.1], [R * 1.1, R * 1.5], [0, R * 1.58]], seg), m);
      t.position.y = crown - R * 0.5;
      face.add(t);
      return;
    }
    default:
  }
}

/** Shoes: sneakers, loafers, oxfords, boots, sandals with the foot showing, heels */
function buildShoe(config: HumanConfig, female: boolean, cut: Cut, mat: MatMaker, detailed: boolean): THREE.Group {
  const shoe = new THREE.Group();
  const style = config.shoeStyle ?? (female ? (cut.top === 'gown' || cut.top === 'dress' ? 'heels' : 'sneakers') : cut.top === 'agbada' || cut.top === 'kaftan' || cut.top === 'jacket' ? 'loafers' : 'sneakers');
  const colour = config.shoeColor ?? (style === 'sneakers' ? 0xf8fafc : 0x1c1917);
  const leather = mat(colour, style === 'sneakers' ? 0.6 : 0.3, style === 'sneakers' ? null : fabric('leather', colour), style === 'loafers' || style === 'oxfords' ? 0.15 : 0);
  const sole = mat(style === 'sneakers' ? 0xf1f5f9 : 0x111111, 0.85);
  const L = female ? 0.22 : 0.26;
  const W = female ? 0.075 : 0.092;
  const seg = detailed ? 14 : 8;
  if (style === 'sandals') {
    const foot = new THREE.Mesh(new THREE.CapsuleGeometry(W * 0.48, L * 0.6, 4, seg), mat(config.skinTone ?? '#4a2c1d', 0.55));
    foot.rotation.x = Math.PI / 2;
    foot.position.set(0, 0.035, L * 0.28);
    shoe.add(foot);
    const s = new THREE.Mesh(new THREE.BoxGeometry(W * 1.05, 0.016, L), sole);
    s.position.set(0, 0.008, L * 0.28);
    shoe.add(s);
    const strap = new THREE.Mesh(new THREE.BoxGeometry(W * 1.08, 0.02, 0.03), leather);
    strap.position.set(0, 0.05, L * 0.35);
    shoe.add(strap);
    return shoe;
  }
  // The upper: a rounded toe and a heel counter, on a sole that shows at the edge
  const upper = new THREE.Mesh(new THREE.CapsuleGeometry(W * 0.5, L * 0.62, 4, seg), leather);
  upper.rotation.x = Math.PI / 2;
  upper.scale.set(1, 1, style === 'boots' ? 1.6 : 0.82);
  upper.position.set(0, style === 'boots' ? 0.07 : 0.045, L * 0.28);
  shoe.add(upper);
  const s = new THREE.Mesh(new THREE.CapsuleGeometry(W * 0.54, L * 0.62, 3, seg), sole);
  s.rotation.x = Math.PI / 2;
  s.scale.set(1, 1, 0.3);
  s.position.set(0, 0.014, L * 0.28);
  shoe.add(s);
  if (style === 'boots') {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.52, W * 0.56, 0.14, seg), leather);
    shaft.position.set(0, 0.12, 0.02);
    shoe.add(shaft);
  }
  if (style === 'heels') {
    const heel = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.07, 6), leather);
    heel.position.set(0, 0.035, -0.02);
    shoe.add(heel);
    upper.position.y = 0.06;
    upper.rotation.x = Math.PI / 2 - 0.3;
  }
  if (style === 'sneakers' && detailed) {
    const swoosh = new THREE.Mesh(new THREE.BoxGeometry(W * 1.02, 0.012, L * 0.4), mat(config.secondaryColor ?? 0x0e7a4e, 0.5));
    swoosh.position.set(0, 0.05, L * 0.2);
    shoe.add(swoosh);
  }
  return shoe;
}
