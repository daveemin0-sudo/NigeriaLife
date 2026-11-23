import * as THREE from 'three';
import type { CharacterConfig } from '../../player/CharacterCustomization';
import { garmentOf, loadSkinnedCharacter, streetDress, wears, type Dress, type SkinnedAnimState, type SkinnedCharacterHandle, type StreetLook } from './SkinnedCharacter';
import { buildOf } from './SkinnedCrowd';
import { RigRegistry } from './RigRegistry';
import { setPersonBaker } from '../MeshBaker';
import type { PatternStyle } from '../../player/ClothingStyle';

/**
 * People further off than the nearest few, drawn as the same character models (not the old figures):
 * the model's low-detail copy (the LOD_ meshes, about a thousand triangles) is posed at a few frames
 * of each action, in the same everyday posture as a full model, and each frame is baked once into a
 * plain mesh. Everyone at the same frame of the same action, in the same cut of clothes, is drawn
 * in one go, each in their own skin, hair and clothes colours. So a person looks the same at every
 * distance: only the detail drops as they go.
 */
export type BakedMode = 'walk' | 'idle' | 'talk' | 'dance' | 'sit';

/** Frames baked for each action (a walk needs enough for the legs to read as walking) */
const FRAMES: Record<BakedMode, number> = { walk: 8, idle: 1, talk: 2, dance: 4, sit: 1 };
/** Parts of the body by material, as the colour each takes */
const PART: Record<string, number> = { Skin_Body: 0, Hair: 1, Cloth_Top: 2, Cloth_Bottom: 3, Cloth_Shoes: 4, Sole: 4, Cloth_Hat: 5, Cloth_Trim: 2 };
const TINTS = ['tSkin', 'tHair', 'tTop', 'tBottom', 'tShoes', 'tHat'] as const;
const MODES: BakedMode[] = ['walk', 'idle', 'talk', 'dance', 'sit'];
/** Garment cuts that read the same far off, each as the one baked for it */
const FAR_TOP: Record<string, string> = { tee_oversized: 'tee', polo: 'tee', shirt: '' };
const FAR_SKIRT: Record<string, string> = { pleated: 'knee', iro: 'maxi' };
const FAR_HAT: Record<string, string> = { fila: 'kufi' };
const FAR_BOTTOM: Record<string, string> = { jeans_slim: 'jeans_straight', jeans_baggy: 'jeans_straight', chinos: 'jeans_straight', cargo: 'jeans_straight', cargo_shorts: 'shorts' };

/** A printed cloth seen from far off: too small to draw, so it is the colour its print comes to */
const printColour = (base: THREE.Color, pattern?: PatternStyle): THREE.Color => {
  if (!pattern?.colour2) return base;
  const second = new THREE.Color(pattern.colour2);
  const third = pattern.colour3 ? new THREE.Color(pattern.colour3) : second;
  return base.clone().multiplyScalar(0.62).add(second.multiplyScalar(0.26)).add(third.clone().multiplyScalar(0.12));
};

interface Model {
  handle: SkinnedCharacterHandle;
  durations: Map<string, number>;
}

interface Batch {
  mesh: THREE.InstancedMesh;
  tints: THREE.InstancedBufferAttribute[];
  count: number;
  /** Whose colours each slot holds (only rewritten when someone else takes the slot) */
  keys: Array<string | number | undefined>;
  tintsDirty: boolean;
}

/** One material for every baked person: the colour of each vertex is its part's colour for that person */
let sharedMaterial: THREE.MeshStandardMaterial | null = null;
const material = (): THREE.MeshStandardMaterial => {
  if (sharedMaterial) return sharedMaterial;
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute float part;
${TINTS.map((t) => `attribute vec3 ${t};`).join('\n')}
varying vec3 vTint;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vTint = part < 0.5 ? tSkin : part < 1.5 ? tHair : part < 2.5 ? tTop : part < 3.5 ? tBottom : part < 4.5 ? tShoes : tHat;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTint;')
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( diffuse * vTint, opacity );');
  };
  m.customProgramCacheKey = () => 'baked-people';
  sharedMaterial = m;
  return m;
};

export class BakedPeople {
  private static models: Partial<Record<'male' | 'female', Model>> = {};
  private static loading: Promise<void> | null = null;
  private static frames = new Map<string, THREE.BufferGeometry>();
  /** Each cut of clothes (Dress.key) as a small number, for the batch keys */
  private static cuts = new Map<string, number>();

  /** Loads the two models once, for every BakedPeople there is */
  public static prepare(): Promise<void> {
    if (!BakedPeople.loading) {
      BakedPeople.loading = Promise.all(
        (['male', 'female'] as const).map(async (gender) => {
          const handle = await loadSkinnedCharacter(gender, { gender } as CharacterConfig);
          if (!handle) return;
          const durations = new Map<string, number>();
          const clips: THREE.AnimationClip[] = (handle.root.children[0]?.userData.animations as THREE.AnimationClip[]) ?? [];
          for (const clip of clips) durations.set(clip.name.toLowerCase(), clip.duration);
          BakedPeople.models[gender] = { handle, durations };
        }),
      ).then(() => {
        // From now on a procedural person baked into a still mesh anywhere is baked as the model
        if (BakedPeople.ready) setPersonBaker((obj, alone, congregation) => BakedPeople.statueFor(obj, alone, congregation));
      });
    }
    return BakedPeople.loading;
  }

  public static get ready(): boolean {
    return !!BakedPeople.models.male && !!BakedPeople.models.female;
  }

  /** By a number made of gender, cut of clothes, action and frame (no string built per person per frame) */
  private readonly batches = new Map<number, Batch>();
  private readonly dresses = new Map<string | number, Dress & { cut: number }>();
  private readonly m = new THREE.Matrix4();
  private readonly p = new THREE.Vector3();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3();
  private static readonly UP = new THREE.Vector3(0, 1, 0);

  public readonly group: THREE.Group;

  constructor(group: THREE.Group) {
    this.group = group;
    void BakedPeople.prepare();
  }

  /** Before drawing a frame's people */
  public begin(): void {
    for (const b of this.batches.values()) b.count = 0;
  }

  /**
   * Draws one person standing at (x, y, z) facing `yaw`, `cycle` turns into what they are doing (a walk's
   * stride: 1 is one full stride of both legs).
   * `lookKey` names the look (the same key, the same look). False until the models have loaded.
   */
  public draw(id: number, look: StreetLook, lookKey: string | number, x: number, y: number, z: number, yaw: number, scale: number, mode: BakedMode, cycle: number): boolean {
    const model = BakedPeople.models[look.gender];
    if (!model) return false;
    let dress = this.dresses.get(lookKey);
    if (!dress) {
      const near = streetDress(look);
      // Far away a sneaker, a formal shoe and a boot look alike: one shoe shape for all (bare feet in slides
      // still show), so shoe styles do not multiply the frames baked (their colour still comes per person).
      // So do the cuts of a tee, a polo and an oversized tee, a shirt and a plain long top, and slim, straight
      // and baggy jeans, chinos and cargo trousers: one of each far off (the hood, shorts and hats still show).
      const v = near.variants;
      const variants = { ...v, top: FAR_TOP[v.top] ?? v.top, bottom: FAR_BOTTOM[v.bottom] ?? v.bottom, shoes: v.feet ? '' : 'sneaker' };
      const skirt = FAR_SKIRT[v.skirt] ?? v.skirt;
      const hat = FAR_HAT[v.hat] ?? v.hat;
      variants.skirt = skirt;
      variants.hat = hat;
      const d = { ...near, variants, key: `${near.mask}|${variants.top}|${variants.bottom}|${hat}|${variants.shoes}|${variants.feet}|${skirt}|${v.dress}|${v.robe}` };
      let cut = BakedPeople.cuts.get(d.key);
      if (cut === undefined) {
        cut = BakedPeople.cuts.size;
        BakedPeople.cuts.set(d.key, cut);
      }
      dress = { ...d, cut, top: printColour(near.top, look.styles?.top?.pattern), bottom: printColour(near.bottom, look.styles?.bottom?.pattern) };
      // Everyone has their own look now (and a new one when they change): the oldest are let go
      if (this.dresses.size > 4000) this.dresses.clear();
      this.dresses.set(lookKey, dress);
    }
    const frames = FRAMES[mode];
    const duration = model.durations.get(mode) ?? 1;
    const frame = frames === 1 ? 0 : Math.floor((((cycle % 1) + 1) % 1) * frames) % frames;
    const key = (((look.gender === 'female' ? 1 : 0) * 4096 + dress.cut) * 8 + MODES.indexOf(mode)) * 8 + frame;
    let batch = this.batches.get(key);
    if (!batch || batch.count >= batch.mesh.instanceMatrix.count) batch = this.grow(key, model, look.gender, dress, mode, frame, (frame + 0.5) / frames * duration, batch);

    const [width] = buildOf(id);
    this.p.set(x, y, z);
    this.q.setFromAxisAngle(BakedPeople.UP, yaw);
    this.s.set(scale * width, scale, scale * width);
    this.m.compose(this.p, this.q, this.s);
    const i = batch.count++;
    batch.mesh.setMatrixAt(i, this.m);
    if (batch.keys[i] !== lookKey) {
      batch.keys[i] = lookKey;
      const colours = [dress.skin, dress.hair, dress.top, dress.bottom, dress.shoes, dress.hatColour];
      for (let t = 0; t < 6; t++) batch.tints[t].setXYZ(i, colours[t].r, colours[t].g, colours[t].b);
      batch.tintsDirty = true;
    }
    return true;
  }

  /** After drawing: meshes nobody stands in this frame are hidden (no draw call) */
  public end(): void {
    for (const b of this.batches.values()) {
      b.mesh.count = b.count;
      b.mesh.visible = b.count > 0;
      if (b.count > 0) {
        b.mesh.instanceMatrix.needsUpdate = true;
        if (b.tintsDirty) for (const t of b.tints) t.needsUpdate = true;
        b.tintsDirty = false;
      }
    }
  }

  /** Hides everyone (the city left) */
  public clear(): void {
    this.begin();
    this.end();
  }

  /** A batch for this frame, made (or made bigger, keeping who is in it) */
  private grow(key: number, model: Model, gender: 'male' | 'female', dress: Dress, mode: BakedMode, frame: number, at: number, old?: Batch): Batch {
    const frameKey = `${gender}|${dress.key}|${mode}|${frame}`;
    let geometry = BakedPeople.frames.get(frameKey);
    if (!geometry) {
      geometry = this.bake(model, dress, mode, at);
      BakedPeople.frames.set(frameKey, geometry);
    }
    const capacity = old ? old.mesh.instanceMatrix.count * 2 : 16;
    // Each batch has its own copy of the frame (the colours per person live on the geometry)
    const geo = geometry.clone();
    const tints = TINTS.map((name) => {
      const attr = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
      attr.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute(name, attr);
      return attr;
    });
    const mesh = new THREE.InstancedMesh(geo, material(), capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.name = `baked_people_${key}`;
    mesh.layers.mask = this.group.layers.mask;
    const batch: Batch = { mesh, tints, count: 0, keys: [], tintsDirty: true };
    if (old) {
      // Those already drawn this frame move across
      for (let i = 0; i < old.count; i++) {
        old.mesh.getMatrixAt(i, this.m);
        mesh.setMatrixAt(i, this.m);
        for (let t = 0; t < TINTS.length; t++) tints[t].setXYZ(i, old.tints[t].getX(i), old.tints[t].getY(i), old.tints[t].getZ(i));
      }
      batch.count = old.count;
      batch.keys = old.keys.slice();
      this.group.remove(old.mesh);
      old.mesh.geometry.dispose();
      old.mesh.dispose();
    }
    this.group.add(mesh);
    this.batches.set(key, batch);
    return batch;
  }

  private static statues = new Map<string, { geometry: THREE.BufferGeometry; hip: number }>();

  /**
   * A procedural person (a rig's group) about to be baked into a still mesh, as the character model: standing,
   * or seated (legs raised) with its hips where the rig's are, so whatever lowers it onto a seat still does.
   * Full detail for one person baked on their own; less for one among many (a carriage). A congregation's figures keep
   * their full body and face, with their hanging garments in the light copies.
   */
  public static statueFor(obj: THREE.Object3D, alone: boolean, congregation = false): THREE.BufferGeometry | null {
    const entry = RigRegistry.entryOfGroup(obj);
    const rig = entry?.rig.deref();
    if (!entry || !rig) return null;
    const look = entry.look as StreetLook;
    const gender = look.gender === 'female' ? 'female' : 'male';
    const model = BakedPeople.models[gender];
    if (!model) return null;
    const seated = (rig.leftLeg.rotation.x + rig.rightLeg.rotation.x) / 2 < -0.9;
    const dress = streetDress({ ...look, gender });
    const key = `${gender}|${dress.key}|${seated ? 'sit' : 'stand'}|${alone ? 'full' : 'lod'}${congregation ? '|congregation' : ''}`;
    let statue = BakedPeople.statues.get(key);
    if (!statue) {
      statue = BakedPeople.pose(model, dress, seated ? 'sit' : 'idle', !alone, congregation);
      BakedPeople.statues.set(key, statue);
    }
    const geometry = statue.geometry.clone();
    // Seated: hips at the rig's own hip height (in the rig's space), as the rig would have sat
    if (seated) {
      obj.updateWorldMatrix(true, true);
      const hip = obj.worldToLocal(rig.leftLeg.getWorldPosition(new THREE.Vector3())).y;
      geometry.translate(0, hip - statue.hip, 0);
    }
    // Each part in this person's colours
    const part = geometry.getAttribute('part');
    const colours = [dress.skin, dress.hair, dress.top, dress.bottom, dress.shoes, dress.hatColour];
    const colour = new Float32Array(part.count * 3);
    for (let i = 0; i < part.count; i++) {
      const c = colours[part.getX(i)] ?? dress.skin;
      colour[i * 3] = c.r;
      colour[i * 3 + 1] = c.g;
      colour[i * 3 + 2] = c.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colour, 3));
    geometry.deleteAttribute('part');
    return geometry;
  }

  /** The model (full detail, or its low-detail copy) in a cut of clothes, posed still, not indexed */
  private static pose(model: Model, dress: Dress, mode: BakedMode, lod: boolean, lightCloth = false): { geometry: THREE.BufferGeometry; hip: number } {
    const { handle } = model;
    handle.play(mode as SkinnedAnimState, 0);
    handle.poseAt((model.durations.get(mode) ?? 1) * 0.5);
    handle.root.updateMatrixWorld(true);
    const shown = dress.shown;
    const positions: number[] = [];
    const parts: number[] = [];
    /** Smooth normals of the light garments (they have few faces, so face normals would show them) */
    const smooth: number[] = [];
    const v = new THREE.Vector3();
    handle.root.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isSkinnedMesh) return;
      // In a congregation, what hangs on the cloth rig comes from its light copy and everything else as asked
      const isLight = o.name.startsWith('LOD_') || !!o.parent?.name.startsWith('LOD_');
      const onClothRig = lightCloth && !!mesh.skeleton.getBoneByName('cloth_front');
      if (onClothRig ? !isLight : o.name.startsWith('LOD_') !== lod) return;
      const name = o.name.startsWith('LOD_') ? o.name.slice(4) : o.name;
      const garment = garmentOf(o);
      if (garment && !wears(dress, garment)) return;
      if (/^Hair/.test(name) && dress.variants.hat) return;
      const piece = /^Body_c([01]{5})$/.exec(name);
      if (piece && [...piece[1]].some((bit, i) => bit === '1' && shown[i])) return;
      const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      const part = PART[(material?.name ?? '').split(':')[0]] ?? (material?.name === 'Eyes' ? 1 : 0);
      const pos = mesh.geometry.getAttribute('position');
      const idx = mesh.geometry.getIndex();
      const count = idx ? idx.count : pos.count;
      const normals = onClothRig ? BakedPeople.smoothNormals(mesh) : null;
      for (let k = 0; k < count; k++) {
        const i = idx ? idx.getX(k) : k;
        mesh.getVertexPosition(i, v); // skinned, with the seated shape of hanging cloth
        v.applyMatrix4(mesh.matrixWorld);
        positions.push(v.x, v.y, v.z);
        parts.push(part);
        if (lightCloth) smooth.push(normals?.[i * 3] ?? 0, normals?.[i * 3 + 1] ?? 0, normals?.[i * 3 + 2] ?? 0);
      }
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('part', new THREE.Float32BufferAttribute(parts, 1));
    geometry.computeVertexNormals();
    if (lightCloth) {
      const normal = geometry.getAttribute('normal');
      for (let i = 0; i < normal.count; i++) {
        if (smooth[i * 3] || smooth[i * 3 + 1] || smooth[i * 3 + 2]) normal.setXYZ(i, smooth[i * 3], smooth[i * 3 + 1], smooth[i * 3 + 2]);
      }
    }
    const pelvis = handle.root.getObjectByName('pelvis');
    const hip = pelvis ? pelvis.getWorldPosition(new THREE.Vector3()).y : 0.9;
    return { geometry, hip };
  }

  /** A posed mesh's normals, averaged where its faces meet */
  private static smoothNormals(mesh: THREE.SkinnedMesh): Float32Array {
    const pos = mesh.geometry.getAttribute('position');
    const idx = mesh.geometry.getIndex();
    const at = new Float32Array(pos.count * 3), out = new Float32Array(pos.count * 3);
    const v = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      mesh.getVertexPosition(i, v);
      v.applyMatrix4(mesh.matrixWorld).toArray(at, i * 3);
    }
    const faces = idx ? idx.count : pos.count;
    for (let t = 0; t + 2 < faces; t += 3) {
      const [i, j, k] = idx ? [idx.getX(t), idx.getX(t + 1), idx.getX(t + 2)] : [t, t + 1, t + 2];
      a.fromArray(at, i * 3);
      b.fromArray(at, j * 3).sub(a);
      c.fromArray(at, k * 3).sub(a);
      b.cross(c);
      for (const n of [i, j, k]) { out[n * 3] += b.x; out[n * 3 + 1] += b.y; out[n * 3 + 2] += b.z; }
    }
    for (let i = 0; i < pos.count; i++) {
      const l = Math.hypot(out[i * 3], out[i * 3 + 1], out[i * 3 + 2]) || 1;
      out[i * 3] /= l; out[i * 3 + 1] /= l; out[i * 3 + 2] /= l;
    }
    return out;
  }

  /** The low-detail model in this cut of clothes, posed `at` seconds into the action, as one plain mesh */
  private bake(model: Model, dress: Dress, mode: BakedMode, at: number): THREE.BufferGeometry {
    const { handle } = model;
    handle.play(mode as SkinnedAnimState, 0);
    handle.poseAt(at); // the clip at this moment, with the everyday posture over it, as on a full model
    handle.root.updateMatrixWorld(true);

    const shown = dress.shown;
    const positions: number[] = [];
    const parts: number[] = [];
    const index: number[] = [];
    const v = new THREE.Vector3();
    handle.root.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isSkinnedMesh || !o.name.startsWith('LOD_')) return;
      const name = o.name.slice(4);
      const garment = garmentOf(o);
      if (garment && !wears(dress, garment)) return;
      if (/^Hair/.test(name) && dress.variants.hat) return;
      const piece = /^Body_c([01]{5})$/.exec(name);
      if (piece && [...piece[1]].some((bit, i) => bit === '1' && shown[i])) return;
      const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      const part = PART[(material?.name ?? '').split(':')[0]] ?? 0;
      const pos = mesh.geometry.getAttribute('position');
      const base = positions.length / 3;
      for (let i = 0; i < pos.count; i++) {
        mesh.getVertexPosition(i, v); // skinned, with the seated shape of hanging cloth
        v.applyMatrix4(mesh.matrixWorld);
        positions.push(v.x, v.y, v.z);
        parts.push(part);
      }
      const idx = mesh.geometry.getIndex();
      if (idx) for (let i = 0; i < idx.count; i++) index.push(base + idx.getX(i));
      else for (let i = 0; i < pos.count; i++) index.push(base + i);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('part', new THREE.Float32BufferAttribute(parts, 1));
    geometry.setIndex(index);
    geometry.computeVertexNormals();
    return geometry;
  }
}
