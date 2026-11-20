import * as THREE from 'three';

/**
 * Water that looks like water: two sets of ripples drifting different ways over the surface (so it never
 * repeats in an obvious way), the sky and the sun on it, darker where you look straight down into it and
 * brighter toward the horizon. Sized by where it is in the world, not by the mesh, so a harbour, a lagoon
 * and the ocean all ripple at the same scale. Cheap: one material per colour, a small ripple texture made
 * once, nothing moved on the CPU.
 *
 *   mesh.material = waterMaterial(0x1f6f8b);   // any flat mesh with uvs (a PlaneGeometry)
 *   tickWater(delta);                          // once a frame
 */
const time = { value: 0 };
let ripples: THREE.Texture | null = null;
const materials = new Map<number, THREE.MeshStandardMaterial>();

/** A tileable ripple normal map: a sum of sine waves at whole-number frequencies across the tile */
function rippleTexture(): THREE.Texture {
  if (ripples) return ripples;
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  const waves: Array<[number, number, number, number]> = [];
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 14; i++) {
    const fx = Math.round((rand() - 0.5) * 12);
    const fy = Math.round((rand() - 0.5) * 12) || 1;
    waves.push([fx, fy, 0.25 + rand() * 0.75, rand() * Math.PI * 2]);
  }
  const height = (u: number, v: number) => {
    let h = 0;
    for (const [fx, fy, a, p] of waves) h += a * Math.sin(Math.PI * 2 * (fx * u + fy * v) + p) / Math.hypot(fx, fy);
    return h;
  };
  const e = 1 / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const dx = (height(u + e, v) - height(u - e, v)) * 0.9;
      const dy = (height(u, v + e) - height(u, v - e)) * 0.9;
      const n = new THREE.Vector3(-dx, -dy, 1).normalize();
      const i = (y * size + x) * 4;
      data[i] = Math.round((n.x * 0.5 + 0.5) * 255);
      data[i + 1] = Math.round((n.y * 0.5 + 0.5) * 255);
      data[i + 2] = Math.round((n.z * 0.5 + 0.5) * 255);
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  ripples = tex;
  return tex;
}

/** The water material in this colour (one shared per colour) */
export function waterMaterial(colour = 0x1f6f8b, options: { opacity?: number } = {}): THREE.MeshStandardMaterial {
  const key = colour + (options.opacity ? Math.round(options.opacity * 100) * 0x1000000 : 0);
  const hit = materials.get(key);
  if (hit) return hit;
  const m = new THREE.MeshStandardMaterial({
    color: colour,
    roughness: 0.08,
    metalness: 0.15,
    normalMap: rippleTexture(),
    normalScale: new THREE.Vector2(0.55, 0.55),
    transparent: options.opacity !== undefined && options.opacity < 1,
    opacity: options.opacity ?? 1,
  });
  m.name = 'water';
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uWaterTime = time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWaterXZ;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWaterXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uWaterTime;\nvarying vec2 vWaterXZ;')
      .replace(
        '#include <normal_fragment_maps>',
        `#ifdef USE_NORMALMAP_TANGENTSPACE
  // Two sets of ripples, of different sizes, drifting different ways, at the same scale everywhere
  vec3 rA = texture2D( normalMap, vWaterXZ / 7.0 + vec2( uWaterTime * 0.031, uWaterTime * 0.017 ) ).xyz * 2.0 - 1.0;
  vec3 rB = texture2D( normalMap, vWaterXZ / 3.1 + vec2( -uWaterTime * 0.023, uWaterTime * 0.041 ) ).xyz * 2.0 - 1.0;
  vec3 mapN = normalize( vec3( rA.xy + rB.xy * 0.7, rA.z * rB.z ) );
  mapN.xy *= normalScale;
  normal = normalize( tbn * mapN );
#endif`,
      )
      .replace(
        '#include <opaque_fragment>',
        `// Looking along the water it mirrors the bright sky; straight down into it, it is deep and dark
  float facing = clamp( dot( normalize( vViewPosition ), normal ), 0.0, 1.0 );
  float fresnel = pow( 1.0 - facing, 4.0 );
  outgoingLight = mix( outgoingLight * 0.85, outgoingLight + vec3( 0.32, 0.4, 0.46 ), fresnel * 0.55 );
#include <opaque_fragment>`,
      );
  };
  m.customProgramCacheKey = () => `water-${options.opacity ?? 1}`;
  materials.set(key, m);
  return m;
}

/** The ripples move on: once a frame */
export function tickWater(delta: number): void {
  time.value += delta;
}

/** A flat sheet of water, w by d, its middle at (x, y, z) */
export function waterSheet(w: number, d: number, x: number, y: number, z: number, colour?: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), waterMaterial(colour));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.name = 'water';
  mesh.receiveShadow = true;
  return mesh;
}
