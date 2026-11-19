import * as THREE from 'three';
import { AssetManager } from '../../assets/AssetManager';
import { WARDROBE_CATALOGUE, type CharacterConfig } from '../../player/CharacterCustomization';
import { makeClothMaterial, makeSkinMaterial } from './CharacterSurfaces';
import type { Pattern } from './Fabrics';

/**
 * Production skinned-human runtime:
 * - Loads Mixamo / Quaternius GLBs via AssetManager (SkeletonUtils clones)
 * - AnimationMixer with cross-fades (idle / walk / run / sit)
 * - Skin + outfit colour mapping onto authored materials
 * - PersonBuilder remains the procedural fallback elsewhere
 */

export type SkinnedAnimState = 'idle' | 'walk' | 'run' | 'sit' | 'drive' | 'dance' | 'talk' | 'phone_call';

export interface SkinnedCharacterHandle {
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  play: (state: SkinnedAnimState, fade?: number) => void;
  update: (delta: number) => void;
  applyAppearance: (config: CharacterConfig) => void;
  dispose: () => void;
  /** Approximate height after normalize (metres) */
  height: number;
}

const ANIM_ALIASES: Record<SkinnedAnimState, string[]> = {
  idle: ['idle', 'Idle', 'Idle_Loop', 'standing'],
  walk: ['walk', 'Walk', 'Walking', 'Walk_Forward'],
  run: ['run', 'Run', 'Running', 'Sprint'],
  sit: ['sit', 'Sit', 'SitDown', 'Sitting'],
  drive: ['drive', 'Drive', 'Driving', 'Sit', 'SitDown'],
  dance: ['dance', 'Dance', 'Victory'],
  talk: ['talk', 'Talk', 'agree', 'Talking'],
  phone_call: ['phone', 'Phone', 'Talk', 'agree'],
};

function findClip(actions: Map<string, THREE.AnimationAction>, state: SkinnedAnimState): THREE.AnimationAction | null {
  for (const name of ANIM_ALIASES[state]) {
    const hit = actions.get(name.toLowerCase());
    if (hit) return hit;
  }
  return actions.get('idle') || actions.values().next().value || null;
}

function classifyMaterial(name: string): 'skin' | 'hair' | 'cloth' | 'other' {
  const n = name.toLowerCase();
  if (/skin|body|face|flesh|arm|leg|head|beta_surface|limb/.test(n)) return 'skin';
  if (/hair|brow|beard|scalp/.test(n)) return 'hair';
  if (/cloth|shirt|pant|jean|dress|shoe|boot|jacket|tee|polo|fabric|outfit|casual|suit|mat/.test(n)) return 'cloth';
  // Quaternius multi-mesh often uses Cube004_* with generic mat names — treat non-skin as cloth
  if (/cube|material|lambert|phong|standard/.test(n)) return 'cloth';
  return 'other';
}

function outfitPattern(styleKey: string | undefined): Pattern {
  const k = (styleKey || '').toLowerCase();
  if (k.includes('polo')) return 'pique';
  if (k.includes('denim') || k.includes('jean')) return 'denim';
  if (k.includes('ankara')) return 'ankara';
  if (k.includes('aso') || k.includes('agbada') || k.includes('kaftan') || k.includes('senator')) return 'aso_oke';
  if (k.includes('gold')) return 'gold_chain';
  return 'cotton';
}

/** Normalize authored humanoids so feet sit on y=0 and height ≈ 1.75m */
function normalizeGroundAndScale(root: THREE.Group, targetHeight = 1.75): number {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (size.y < 0.01) return targetHeight;
  const scale = targetHeight / size.y;
  root.scale.multiplyScalar(scale);
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(root);
  root.position.y -= box2.min.y;
  return targetHeight;
}

/**
 * Load a gender-specific skinned human GLB. Returns null if the asset is missing
 * (caller should keep PersonBuilder visible).
 */
export async function loadSkinnedCharacter(
  gender: 'male' | 'female',
  config: CharacterConfig,
): Promise<SkinnedCharacterHandle | null> {
  const url = `/models/characters/human_${gender}.glb`;
  const scene = await AssetManager.getInstance().instantiate(url);
  if (!scene) return null;

  const root = new THREE.Group();
  root.name = `skinned_${gender}`;
  root.add(scene);

  // Strip pack props (guns, bats, etc.) — keep only the skinned body
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (mesh.type === 'SkinnedMesh') return;
    const n = mesh.name.toLowerCase();
    if (/axe|guitar|knife|pistol|rifle|shotgun|smg|spear|bat|gun|weapon|sword|shield/.test(n)) {
      mesh.visible = false;
    }
  });

  const height = normalizeGroundAndScale(root, gender === 'female' ? 1.68 : 1.78);

  const mixer = new THREE.AnimationMixer(scene);
  const actions = new Map<string, THREE.AnimationAction>();
  const clips: THREE.AnimationClip[] = scene.userData.animations || [];
  for (const clip of clips) {
    actions.set(clip.name.toLowerCase(), mixer.clipAction(clip));
  }

  let current: THREE.AnimationAction | null = null;
  const play = (state: SkinnedAnimState, fade = 0.25) => {
    const next = findClip(actions, state);
    if (!next || next === current) return;
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(fade).play();
    if (current) current.fadeOut(fade);
    current = next;
  };

  const applyAppearance = (cfg: CharacterConfig) => {
    const skinHex = cfg.skinTone || (gender === 'female' ? '#7a4b33' : '#5c3a28');
    const hairHex = cfg.hairColor || '#0b0908';
    const topItem = WARDROBE_CATALOGUE.find((i) => i.id === cfg.topId);
    const bottomItem = WARDROBE_CATALOGUE.find((i) => i.id === cfg.bottomId);
    const outfitCol = topItem?.color ?? 0x1e3a8a;
    const trousersCol =
      bottomItem?.color ??
      (typeof cfg.trousersColor === 'string' ? new THREE.Color(cfg.trousersColor).getHex() : 0x1e3a5f);
    const pattern = outfitPattern(topItem?.styleKey || cfg.attire);
    const skinMat = makeSkinMaterial(skinHex);
    const hairMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(hairHex), roughness: 0.92 });
    const topMat = makeClothMaterial(outfitCol, pattern, topItem?.secondaryColor ?? 0xe5b84b);
    const bottomMat = makeClothMaterial(trousersCol, pattern === 'denim' ? 'denim' : 'cotton', trousersCol);

    let clothIndex = 0;
    const meshCount = { n: 0 };
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      meshCount.n += 1;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const multiPart = mesh.name.startsWith('Cube') || mats.length > 1;
      const replaced = mats.map((m, i) => {
        const name = `${mesh.name}|${(m as THREE.Material).name || ''}|${i}`;
        const kind = classifyMaterial(name);
        const hasMap = !!(m as THREE.MeshStandardMaterial).map;

        // Multi-mesh Quaternius bodies: swap dedicated skin/cloth mats
        if (multiPart && !hasMap) {
          if (kind === 'skin') return skinMat;
          if (kind === 'hair') return hairMat;
          clothIndex += 1;
          return clothIndex <= 2 ? topMat : bottomMat;
        }

        // Textured authored characters (e.g. Matt): keep maps, tint toward Nigerian skin / outfit
        if (m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshPhysicalMaterial) {
          const next = m.clone();
          if (hasMap) {
            // Warm the albedo toward configured melanin without destroying authored paint
            next.color.lerp(new THREE.Color(skinHex), 0.35);
            next.roughness = Math.min(0.9, Math.max(0.45, next.roughness ?? 0.6));
            next.metalness = Math.min(next.metalness ?? 0, 0.08);
          } else if (kind === 'skin') {
            return skinMat;
          } else {
            clothIndex += 1;
            next.color.copy(new THREE.Color(clothIndex <= 2 ? outfitCol : trousersCol));
          }
          return next;
        }
        return m;
      });
      mesh.material = replaced.length === 1 ? replaced[0] : replaced;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
  };

  applyAppearance(config);
  play('idle', 0);

  return {
    root,
    mixer,
    play,
    update: (delta: number) => {
      mixer.update(delta);
    },
    applyAppearance,
    dispose: () => {
      mixer.stopAllAction();
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry?.dispose?.();
        }
      });
    },
    height,
  };
}
