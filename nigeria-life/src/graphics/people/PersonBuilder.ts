import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { HumanConfig, HumanRig } from '../HumanMeshBuilder';
import { fabric, hairGrain, type Pattern } from './Fabrics';
import {
  addFrontFolds,
  addSideDrape,
  makeClothMaterial,
  makeSkinMaterial,
  swayCloth,
} from './CharacterSurfaces';

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
    case 'tshirt':
      return {
        ...base,
        top: 'tee',
        pattern: pattern ?? 'cotton',
        bottom: 'jeans',
        bottomColour: config.trousersColor ?? 0x1e3a8a,
        bottomPattern: 'denim',
      };
    case 'polo_shirt':
    case 'student_casual':
      return {
        ...base,
        top: 'polo',
        sleeves: 'short',
        collar: true,
        buttons: true,
        pattern: pattern ?? 'pique',
        hem: female ? 0.88 : 0.9,
        bottom: 'trousers',
        bottomColour: config.trousersColor ?? 0x1e3a5f,
        bottomPattern: 'plain',
      };
    case 'button_shirt':
      return {
        ...base,
        top: 'shirt',
        sleeves: 'long',
        collar: true,
        buttons: true,
        pattern: pattern ?? 'check',
        accent: config.accentColor ?? 0xffffff,
        bottom: 'jeans',
        bottomColour: config.trousersColor ?? 0x1e3a8a,
        bottomPattern: 'denim',
      };
    case 'ankara_shirt': return { ...base, top: 'shirt', sleeves: 'short', collar: true, buttons: true, pattern: 'ankara', accent: config.accentColor ?? 0xfacc15, bottom: 'trousers', bottomColour: config.trousersColor ?? 0x111827 };
    // Open black shirt with metallic gold chain print + board shorts (dock hero)
    case 'street_gold_shirt':
      return {
        ...base,
        top: 'shirt',
        sleeves: 'short',
        hem: 0.88,
        collar: true,
        buttons: false,
        pattern: 'gold_chain',
        colour: config.outfitColor ?? 0x111111,
        accent: config.accentColor ?? 0xd4af37,
        bottom: 'shorts',
        bottomColour: config.trousersColor ?? 0x111111,
        bottomPattern: 'gold_chain',
      };
    // Charcoal tee, backwards cap look (Jason)
    case 'jason_dock':
      return {
        ...base,
        top: 'tee',
        sleeves: 'short',
        hem: 0.9,
        pattern: 'knit',
        colour: config.outfitColor ?? 0x333333,
        bottom: 'shorts',
        bottomColour: config.trousersColor ?? 0x3b82f6,
        bottomPattern: 'stripes',
      };
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
    default: return base;
  }
}

/** Apply wardrobe bottom choice over the outfit's default lower half */
function withBottom(cut: Cut, config: HumanConfig): Cut {
  const b = config.bottomStyle;
  if (!b) return cut;
  if (b === 'jeans') return { ...cut, bottom: 'jeans', bottomPattern: 'denim' };
  if (b === 'trousers') return { ...cut, bottom: 'trousers', bottomPattern: 'plain' };
  if (b === 'shorts') return { ...cut, bottom: 'shorts', bottomPattern: 'plain' };
  if (b === 'joggers') return { ...cut, bottom: 'joggers', bottomPattern: 'knit' };
  if (b === 'skirt') return { ...cut, bottom: 'skirt', bottomPattern: cut.bottomPattern };
  if (b === 'wrapper') return { ...cut, bottom: 'wrapper', bottomPattern: 'aso_oke' };
  if (b === 'none') return { ...cut, bottom: 'none' };
  return cut;
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
  // Street LOD still gets readable faces (glint, nostrils, lip line) — proportions stay 8-head
  const faceDetail = true;
  const seg = detailed ? 36 : 20;
  const group = new THREE.Group();
  const materials: THREE.Material[] = [];
  const clothMotion: THREE.Object3D[] = [];
  const keepFromMerge = new Set<THREE.Object3D>();
  // One material for each look of surface, so pieces alike can be drawn together
  const made = new Map<string, THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial>();
  const mat = (colour: number | string, rough = 0.7, map: THREE.Texture | null = null, metal = 0) => {
    const key = `${new THREE.Color(colour).getHex()}|${rough}|${map?.uuid ?? ''}|${metal}`;
    const known = made.get(key);
    if (known) return known;
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(colour), roughness: rough, metalness: metal, ...(map ? { map } : {}) });
    materials.push(m);
    made.set(key, m);
    return m;
  };
  const build: Build = (config.build as Build | undefined) ?? 'average';
  const breadth = build === 'slim' ? 0.94 : build === 'broad' ? 1.14 : 1.02;
  const shape: HeadShape = (config.headShape as HeadShape | undefined) ?? (female ? 'oval' : 'round');
  const skinHex = config.skinTone || (female ? SKIN_DEFAULT.female : SKIN_DEFAULT.male);
  // ART-BIBLE skin: warm sheen as stylized SSS — deeper cavities use cooler/darker skin
  const skin = makeSkinMaterial(skinHex);
  materials.push(skin);
  const skinDeep = makeSkinMaterial(new THREE.Color(skinHex).multiplyScalar(0.72).getHex());
  skinDeep.roughness = 0.62;
  skinDeep.sheen = 0.35;
  materials.push(skinDeep);
  const hairColour = new THREE.Color(config.hairColor ?? '#0b0908').getHex();
  const cut = withBottom(cutFor(config, female), config);
  const clothSatin =
    cut.pattern === 'aso_oke' ||
    cut.pattern === 'gold_chain' ||
    cut.pattern === 'lace' ||
    config.outfit === 'street_gold_shirt' ||
    config.outfit === 'kaftan' ||
    config.outfit === 'agbada' ||
    config.outfit === 'senator';
  const top = makeClothMaterial(cut.colour, cut.pattern, cut.accent, { satin: clothSatin });
  materials.push(top);
  const trim = makeClothMaterial(cut.accent, cut.pattern === 'plain' ? 'plain' : cut.pattern, cut.accent, { satin: true, roughness: 0.35 });
  materials.push(trim);
  const bottom = makeClothMaterial(
    cut.bottomColour,
    cut.bottomPattern,
    cut.top === 'chef' ? 0xffffff : 0x111827,
    { satin: cut.bottomPattern === 'gold_chain' || cut.bottomPattern === 'aso_oke', roughness: cut.bottomPattern === 'denim' ? 0.88 : undefined },
  );
  materials.push(bottom);
  const dark = mat(0x0b0b0c, 0.5);
  // Tee / Jason: soft cotton knit sheen
  if (config.outfit === 'jason_dock' || cut.top === 'tee') {
    top.sheen = 0.35;
    top.sheenRoughness = 0.65;
    top.roughness = 0.78;
  }

  // Ground shadow
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false });
  materials.push(shadowMat);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 18), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  group.add(shadow);

  // ---------------------------------------------------------------- Torso (8-head with natural shoulder→waist→hip mass)
  const torsoY = female ? 1.08 : 1.14;
  const torso = new THREE.Group();
  torso.position.y = torsoY;
  group.add(torso);
  // Slightly narrower chest so the silhouette reads human, not an inverted-triangle golem
  const sx = (female ? 1.16 : 1.18) * breadth;
  const sz = (female ? 0.8 : 0.76) * (build === 'broad' ? 1.08 : 1);
  // Open neckline + rounded shoulder mass in the torso itself (arms tuck under the yoke)
  const profile: Array<[number, number]> = female
    ? [[0.0, -0.38], [0.155, -0.36], [0.2, -0.28], [0.185, -0.16], [0.132, -0.05], [0.128, 0.05], [0.15, 0.14], [0.165, 0.2], [0.17, 0.24], [0.14, 0.265], [0.095, 0.282], [0.072, 0.292]]
    : [[0.0, -0.4], [0.15, -0.38], [0.18, -0.3], [0.165, -0.2], [0.145, -0.08], [0.15, 0.04], [0.175, 0.13], [0.195, 0.195], [0.2, 0.235], [0.175, 0.26], [0.115, 0.282], [0.078, 0.298]];
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
  // Soft clavicle fill at the collar hole
  const trap = new THREE.Mesh(
    lathe(
      [
        [0.07, 0.296],
        [0.09, 0.29],
        [0.105, 0.278],
        [0.1, 0.265],
      ],
      seg,
      sx * 0.5,
      sz * 0.82,
    ),
    torsoTop.material as THREE.Material,
  );
  torso.add(trap);
  // Shoulder yoke: sloping cloth from collar → sleeve seam (breaks the square shelf silhouette)
  for (const side of [-1, 1] as const) {
    const yoke = new THREE.Mesh(
      new THREE.BoxGeometry(female ? 0.11 : 0.13, female ? 0.045 : 0.05, female ? 0.1 : 0.11),
      torsoTop.material as THREE.Material,
    );
    yoke.position.set(side * (female ? 0.12 : 0.135) * breadth, female ? 0.255 : 0.268, 0.01);
    yoke.rotation.z = side * -0.38;
    yoke.rotation.x = -0.08;
    yoke.scale.set(1, 0.85, 1);
    torso.add(yoke);
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
      // Polo / shirt collars: wider, flatter wings that sit on the trap
      const polo = cut.top === 'polo';
      const wing = new THREE.Mesh(
        new THREE.BoxGeometry(polo ? 0.095 : 0.075, polo ? 0.038 : 0.045, polo ? 0.016 : 0.012),
        cut.top === 'jacket' ? mat(0xffffff, 0.6) : top,
      );
      wing.position.set(s * (polo ? 0.042 : 0.038), female ? 0.255 : 0.268, frontAt(0.25) - (polo ? 0.002 : 0.01));
      wing.rotation.set(polo ? -0.22 : -0.5, polo ? s * 0.1 : 0, s * (polo ? 0.28 : 0.5));
      torso.add(wing);
    }
    if (cut.top === 'polo' && detailed) {
      // Thin ribbed stand collar around the open neckline — below the chin
      const band = new THREE.Mesh(lathe([[0.07, 0.268], [0.076, 0.282], [0.07, 0.292]], seg, sx * 0.52, sz * 0.9), top);
      torso.add(band);
      const placket = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.1, 0.006), top);
      placket.position.set(0, 0.19, frontAt(0.19) + 0.003);
      torso.add(placket);
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
  // Open unbuttoned gold-chain shirt: skin strip down the chest + collar wings out
  if (config.outfit === 'street_gold_shirt' && detailed) {
    const skinStrip = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.42), skin);
    skinStrip.position.set(0, 0.08, frontAt(0.08) + 0.004);
    torso.add(skinStrip);
    for (const s of [-1, 1]) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.4, 0.01), top);
      edge.position.set(s * 0.055, 0.08, frontAt(0.08) + 0.006);
      edge.rotation.y = s * 0.35;
      torso.add(edge);
    }
  }

  // Cloth folds on everyday Lagos streetwear + traditional (polo / tee / shirt included)
  if (detailed) {
    const foldZ = frontAt(0.1) + 0.014;
    const wantsFolds =
      cut.pattern === 'ankara' ||
      cut.pattern === 'aso_oke' ||
      cut.pattern === 'gold_chain' ||
      cut.pattern === 'pique' ||
      cut.pattern === 'cotton' ||
      config.outfit === 'street_gold_shirt' ||
      config.outfit === 'jason_dock' ||
      config.outfit === 'kaftan' ||
      config.outfit === 'senator' ||
      config.outfit === 'polo_shirt' ||
      cut.top === 'tee' ||
      cut.top === 'polo' ||
      cut.top === 'shirt' ||
      cut.top === 'kaftan' ||
      cut.top === 'agbada';
    if (wantsFolds) {
      const softKnit = cut.top === 'polo' || cut.top === 'tee';
      const folds = addFrontFolds(torso, top, {
        count: softKnit ? 3 : 5,
        z: foldZ - (softKnit ? 0.004 : 0),
        y0: softKnit || config.outfit === 'jason_dock' ? -0.06 : -0.22,
        y1: softKnit ? 0.1 : 0.22,
        width: (female ? 0.18 : 0.2) * breadth,
        soft: softKnit,
      });
      for (const f of folds) {
        keepFromMerge.add(f);
        clothMotion.push(f);
      }
    }
    if (config.outfit === 'street_gold_shirt' || cut.top === 'kaftan' || cut.top === 'agbada') {
      for (const s of [-1, 1] as const) {
        const drape = addSideDrape(torso, top, s, {
          x: s * interp(profile, 0.05) * sx * 1.05,
          y0: -0.28,
          y1: 0.2,
          z: 0.02,
        });
        keepFromMerge.add(drape);
        clothMotion.push(drape);
      }
    }
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

  // ---------------------------------------------------------------- Head and neck — visible skin column through the open collar
  const head = new THREE.Group();
  // Collar ~1.44; head ~1.50 → short visible neck, not a pipe
  head.position.set(0, female ? 1.45 : 1.5, 0);
  group.add(head);
  const neckR = (female ? 0.054 : 0.06) * (build === 'broad' ? 1.06 : 1);
  const neck = new THREE.Mesh(
    lathe(
      [
        [neckR * 1.2, -0.1],
        [neckR * 1.08, -0.06],
        [neckR * 1.02, -0.02],
        [neckR * 0.98, 0.02],
        [neckR * 0.95, 0.05],
      ],
      seg,
      1.04,
      0.9,
    ),
    skin,
  );
  neck.position.z = -0.002;
  head.add(neck);
  // Slightly larger skull so the head doesn't read tiny against the chest
  const R = female ? 0.112 : 0.122;
  const C = new THREE.Vector3(0, female ? 0.042 : 0.046, 0.014);
  // Higher-resolution skull topology for stylized-real face read
  const skull = new THREE.Mesh(shapeIt(new THREE.SphereGeometry(R, detailed ? 56 : 28, detailed ? 42 : 20), R, shape), skin);
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
    if (faceDetail) {
      const inner = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), skinDeep);
      inner.scale.set(0.3, 0.9, 0.6);
      inner.position.copy(ear.position).add(new THREE.Vector3(s * 0.006, 0, 0.004));
      face.add(inner);
    }
  }
  // Eyes: orbital socket + layered sclera / iris sphere / pupil / cornea glint + almond lids
  const white = new THREE.MeshPhysicalMaterial({ color: 0xf7f3ea, roughness: 0.22, metalness: 0.02, sheen: 0.2, sheenColor: 0xffffff });
  materials.push(white);
  const irisCol = config.eyeColor ?? 0x3b1f0e;
  const iris = new THREE.MeshPhysicalMaterial({ color: irisCol, roughness: 0.35, metalness: 0.05, sheen: 0.15, sheenColor: 0xffffff });
  materials.push(iris);
  const pupil = mat(0x050505, 0.08);
  const glint = new THREE.MeshBasicMaterial({ color: 0xffffff });
  materials.push(glint);
  for (const s of [-1, 1]) {
    const eyeAt = at(s * 0.34, 0.02, 0.9);
    const eye = new THREE.Group();
    eye.position.copy(eyeAt);
    eye.rotation.y = s * 0.18;
    face.add(eye);
    // Soft orbital recess
    if (faceDetail) {
      const orbit = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12), skinDeep);
      orbit.scale.set(1.35, 0.95, 0.55);
      orbit.position.set(0, 0.002, -0.006);
      eye.add(orbit);
    }
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.0152, faceDetail ? 20 : 10, faceDetail ? 16 : 8), white);
    ball.scale.set(1.28, 0.88, 0.78);
    eye.add(ball);
    // Domed iris (not a flat disc)
    const ir = new THREE.Mesh(new THREE.SphereGeometry(0.0088, faceDetail ? 18 : 10, faceDetail ? 14 : 8), iris);
    ir.scale.set(1, 1, 0.45);
    ir.position.z = 0.0095;
    eye.add(ir);
    const pu = new THREE.Mesh(new THREE.SphereGeometry(0.0042, 12, 10), pupil);
    pu.scale.set(1, 1, 0.5);
    pu.position.z = 0.0115;
    eye.add(pu);
    if (faceDetail) {
      const cornea = new THREE.Mesh(
        new THREE.SphereGeometry(0.016, 12, 10),
        new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.18, transmission: 0.4 }),
      );
      materials.push(cornea.material as THREE.Material);
      cornea.scale.set(1.28, 0.88, 0.55);
      cornea.position.z = 0.004;
      eye.add(cornea);
      const gl = new THREE.Mesh(new THREE.CircleGeometry(0.0018, 8), glint);
      gl.position.set(0.003, 0.0032, 0.014);
      eye.add(gl);
    }
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.0165, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), skin);
    lid.scale.set(1.32, 0.92, 0.8);
    lid.position.y = 0.0025;
    eye.add(lid);
    const lower = new THREE.Mesh(new THREE.SphereGeometry(0.0158, 16, 10, 0, Math.PI * 2, Math.PI * 0.68, Math.PI * 0.32), skin);
    lower.scale.set(1.3, 0.88, 0.76);
    eye.add(lower);
    if (female && faceDetail) {
      const lash = new THREE.Mesh(new THREE.TorusGeometry(0.015, 0.002, 4, 14, Math.PI * 0.9), dark);
      lash.rotation.z = Math.PI * 0.05;
      lash.scale.set(1.28, 0.78, 1);
      lash.position.set(0, 0.0035, 0.005);
      eye.add(lash);
    }
    const brow = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([at(s * 0.16, 0.22, 1.02), at(s * 0.34, 0.28, 1.025), at(s * 0.52, 0.22, 1.0)]),
        faceDetail ? 12 : 8,
        female ? 0.0038 : 0.0055,
        6,
        false,
      ),
      mat(hairColour, 0.9),
    );
    face.add(brow);
  }
  // Nose: fuller bridge, tip, alae, defined nostrils
  const noseW = config.noseWidth ?? (female ? 0.95 : 1.08);
  const bridge = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.05, 6, 14), skin);
  bridge.scale.set(1.05, 1, 0.75);
  bridge.position.copy(at(0, -0.12, 0.978));
  bridge.rotation.x = 0.28;
  face.add(bridge);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.0135, faceDetail ? 20 : 12, faceDetail ? 16 : 10), skin);
  tip.scale.set(1.35 * noseW, 0.85, 0.95);
  tip.position.copy(at(0, -0.3, 1.045));
  face.add(tip);
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.SphereGeometry(0.0115, faceDetail ? 16 : 10, faceDetail ? 12 : 8), skin);
    wing.scale.set(0.95, 0.85, 0.88);
    wing.position.copy(at(s * 0.16 * noseW, -0.318, 0.99));
    face.add(wing);
    if (faceDetail) {
      const hole = new THREE.Mesh(new THREE.SphereGeometry(0.0052, 10, 8), skinDeep);
      hole.scale.set(1.25, 0.55, 1.1);
      hole.position.copy(at(s * 0.075 * noseW, -0.36, 1.028));
      face.add(hole);
    }
  }
  // Lips: cupid bow + fuller lower with soft sheen
  const lipColour = config.lipColor ?? new THREE.Color(skinHex).multiplyScalar(0.62).lerp(new THREE.Color(female ? 0x7a2a2e : 0x3a1a12), female ? 0.35 : 0.2).getHex();
  const lip = new THREE.MeshPhysicalMaterial({
    color: lipColour,
    roughness: female ? 0.32 : 0.45,
    metalness: 0,
    sheen: 0.55,
    sheenRoughness: 0.35,
    sheenColor: new THREE.Color(lipColour).lerp(new THREE.Color(0xff8866), 0.3),
  });
  materials.push(lip);
  const upperLip = new THREE.Mesh(new THREE.SphereGeometry(0.021, faceDetail ? 18 : 12, faceDetail ? 12 : 8), lip);
  upperLip.scale.set(1.62, 0.4, 0.68);
  upperLip.position.copy(at(0, -0.465, 1.005));
  face.add(upperLip);
  // Cupid's bow peaks
  if (faceDetail) {
    for (const s of [-1, 1]) {
      const peak = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), lip);
      peak.scale.set(0.9, 0.55, 0.7);
      peak.position.copy(at(s * 0.09, -0.445, 1.02));
      face.add(peak);
    }
  }
  const lowerLip = new THREE.Mesh(new THREE.SphereGeometry(0.022, faceDetail ? 18 : 12, faceDetail ? 12 : 8), lip);
  lowerLip.scale.set(1.48, 0.58, 0.75);
  lowerLip.position.copy(at(0, -0.535, 0.99));
  face.add(lowerLip);
  if (faceDetail) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.0018, 0.004), mat(0x1a0b07, 0.9));
    line.position.copy(at(0, -0.498, 1.018));
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
  // Round the neck — thicker pendant chain for street_gold_shirt (dock hero)
  if (config.hasGoldChain || config.outfit === 'street_gold_shirt') {
    const thick = config.outfit === 'street_gold_shirt';
    const chain = new THREE.Mesh(
      new THREE.TorusGeometry(neckR * (thick ? 1.65 : 1.5), thick ? 0.01 : 0.006, 6, 28),
      mat(0xd4af37, 0.18, null, 0.95),
    );
    chain.rotation.x = Math.PI / 2 + 0.35;
    chain.position.set(0, -0.15, 0.025);
    head.add(chain);
    if (thick) {
      const pendant = new THREE.Mesh(new THREE.CircleGeometry(0.028, 16), mat(0xd4af37, 0.15, null, 0.98));
      pendant.position.set(0, -0.28, 0.12);
      head.add(pendant);
    }
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

  // ---------------------------------------------------------------- Arms — continuous sleeve caps (no ball joints)
  const shoulderX = (female ? 0.19 : 0.225) * (build === 'slim' ? 0.96 : build === 'broad' ? 1.05 : 1);
  const upperLen = female ? 0.28 : 0.32;
  const foreLen = female ? 0.26 : 0.3;
  const armR = (female ? 0.055 : 0.068) * breadth;
  const sleeveMat = cut.top === 'agbada' || cut.top === 'kaftan' || cut.top === 'buba' ? top : cut.top === 'overall' && cut.sleeves === 'none' ? skin : top;
  const coatMat = cut.coat !== undefined ? mat(cut.coat, 0.55) : null;
  const makeArm = (side: -1 | 1) => {
    const arm = new THREE.Group();
    // Tuck under the yoke so the silhouette slopes instead of shelving
    arm.position.set(side * shoulderX, female ? 1.3 : 1.36, 0.01);
    arm.rotation.z = side * 0.08;
    group.add(arm);
    const sleeveLen = cut.sleeves === 'none' ? 0 : cut.sleeves === 'short' ? upperLen * 0.55 : upperLen;
    const ease = cut.sleeves === 'wide' ? 0.06 : cut.top === 'polo' ? 0.014 : 0.01;
    if (sleeveLen > 0) {
      // Continuous sleeve from torso seam → hem (no sphere joint — kills the action-figure shoulder)
      const hemR = (sleeveLen >= upperLen ? armR * 0.9 : armR * 1.02) + ease * (cut.sleeves === 'wide' ? 1.6 : 1);
      const shoulderCap = armR * 1.12 + ease;
      const sleeve = new THREE.Mesh(
        lathe(
          [
            [hemR * 0.96, -sleeveLen - 0.004],
            [hemR, -sleeveLen],
            [armR * 1.05 + ease, -sleeveLen * 0.45],
            [armR * 1.08 + ease, -sleeveLen * 0.15],
            [shoulderCap, -0.015],
            [shoulderCap * 0.92, 0.02],
            [shoulderCap * 0.55, 0.04],
            [0.001, 0.045],
          ],
          seg / 2,
        ),
        coatMat ?? sleeveMat,
      );
      arm.add(sleeve);
    } else {
      // Bare shoulder: soft cap, not a ball joint
      const bare = new THREE.Mesh(
        lathe(
          [
            [armR * 0.95, -0.06],
            [armR * 1.05, -0.02],
            [armR * 1.0, 0.02],
            [armR * 0.55, 0.04],
            [0.001, 0.045],
          ],
          seg / 2,
        ),
        skin,
      );
      arm.add(bare);
    }
    if (sleeveLen > 0) {
      const hemR = (sleeveLen >= upperLen ? armR * 0.9 : armR * 1.02) + ease * (cut.sleeves === 'wide' ? 1.6 : 1);
      // Polo / tee ribbed cuff at the hem — reads as finished fabric, not a cut pipe
      if (detailed && (cut.top === 'polo' || cut.top === 'tee') && cut.sleeves === 'short') {
        const cuff = new THREE.Mesh(
          lathe([[hemR + 0.004, -sleeveLen - 0.002], [hemR + 0.006, -sleeveLen + 0.028]], seg / 2),
          coatMat ?? sleeveMat,
        );
        arm.add(cuff);
      }
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

  // ---------------------------------------------------------------- Legs (hip mass + thigh/calf volume)
  const hipY = female ? 0.76 : 0.8;
  const thighLen = female ? 0.4 : 0.42;
  const shinLen = female ? 0.38 : 0.4;
  const legX = female ? 0.14 : 0.17;
  const legR = (female ? 0.082 : 0.098) * breadth;
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
      set(L.arm, -stride * (running ? 0.85 : 0.48), 0, running ? -0.25 : -0.08); set(Rt.arm, stride * (running ? 0.85 : 0.48), 0, running ? 0.25 : 0.08);
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
      set(L.arm, Math.sin(time * 2) * 0.025, 0, -0.1); set(Rt.arm, -Math.sin(time * 2) * 0.025, 0, 0.1);
      set(L.fore, -0.12); set(Rt.fore, -0.12);
      for (const q of [LL.leg, RL.leg, LL.lower, RL.lower]) set(q, 0);
    }
    // Cloth folds / side drape respond to motion
    if (clothMotion.length) swayCloth(clothMotion, time, walking || running || dancing);
  };

  // Few draw calls: each joint's pieces of one material made into one mesh
  // Keep fold ridges out of merge so swayCloth can move them
  mergeParts(group, new Set<THREE.Object3D>([phoneMesh, shadow, tag, ...keepFromMerge]));
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
      // Gele: denser satin wrap layers + finer pleat fan (material sheen via aso-oke map)
      const cloth = mat(colour, 0.38, fabric(cut.pattern === 'plain' ? 'aso_oke' : cut.pattern, colour, cut.accent));
      for (let i = 0; i < 5; i++) {
        const t = new THREE.Mesh(new THREE.TorusGeometry(R * (1.02 + i * 0.065), R * 0.22, 10, seg), cloth);
        t.rotation.x = Math.PI / 2 - 0.4 - i * 0.02;
        t.position.set(0, crown - R * 0.6 + i * R * 0.2, -R * 0.1 - i * R * 0.04);
        face.add(t);
      }
      cloth.side = THREE.DoubleSide;
      for (let p = 0; p < 13; p++) {
        const a = -1.4 + p * 0.24;
        const pleat = new THREE.Mesh(new THREE.ConeGeometry(R * 0.48, R * 1.75, 5, 1, true), cloth);
        pleat.scale.set(1, 1, 0.18);
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
        const back = !!config.hatBackwards || config.outfit === 'jason_dock';
        brim.position.set(0, crown - R * 0.7, back ? -R * 0.88 : R * 0.88);
        if (back) brim.rotation.y = Math.PI;
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
