import * as THREE from 'three';
import { Builder } from '../../world/kit/ArchKit';
import { Airliner, glowTexture } from './Airliner';
import { STAND, taxiOutCurve, CRUISE_ALTITUDE } from './FlightPlan';

/**
 * What is outside the window: the sky from the ground to the cruise, the cloud deck flown
 * through on the way up and down, the country below with its farms, towns, roads and rivers,
 * and the airport at each end with its runway and lights, taxiways, terminal, jet bridges,
 * tower and the other aircraft on stand.
 */

export type Light = 'day' | 'dusk' | 'night';

const PALETTE: Record<Light, { top: number; horizon: number; fog: number; sun: number; sunAt: THREE.Vector3; hemi: [number, number, number]; sunLevel: number }> = {
  day: { top: 0x2f6fd0, horizon: 0xd6e9fb, fog: 0xcfe3f5, sun: 0xfffbeb, sunAt: new THREE.Vector3(0.45, 0.75, 0.5), hemi: [0xdbeafe, 0x8a9478, 1.1], sunLevel: 2.6 },
  dusk: { top: 0x27306b, horizon: 0xf4a25c, fog: 0xe8b98f, sun: 0xffc28a, sunAt: new THREE.Vector3(-0.7, 0.18, 0.7), hemi: [0xf5c9a0, 0x4f5d3a, 1.1], sunLevel: 1.9 },
  night: { top: 0x0b1840, horizon: 0x3b4d7a, fog: 0x34446b, sun: 0xc7d2fe, sunAt: new THREE.Vector3(0.3, 0.6, -0.5), hemi: [0x9fb4e6, 0x2b3350, 1.0], sunLevel: 0.9 },
};

export function lightFor(hour: number): Light {
  if (hour >= 6.5 && hour < 17.5) return 'day';
  if ((hour >= 17.5 && hour < 19.2) || (hour >= 5.5 && hour < 6.5)) return 'dusk';
  return 'night';
}

function cloudTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  let seed = 3;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 26; i++) {
    const x = 50 + rnd() * 156;
    const y = 70 + rnd() * 110;
    const r = 30 + rnd() * 46;
    const grad = g.createRadialGradient(x, y - r * 0.2, 0, x, y, r);
    // Lit from above, grey in the belly
    const shade = Math.round(255 - Math.max(0, (y - 110) / 90) * 46);
    grad.addColorStop(0, `rgba(${shade},${shade},${Math.min(255, shade + 6)},0.9)`);
    grad.addColorStop(0.6, `rgba(${shade},${shade},${Math.min(255, shade + 6)},0.5)`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Fields, bush, compounds and footpaths: the country seen from the air, repeated across the ground */
function farmlandTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 1024;
  const g = c.getContext('2d')!;
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  g.fillStyle = '#6b8f4a';
  g.fillRect(0, 0, 1024, 1024);
  const fields = ['#7ea152', '#8ca35b', '#a39a5b', '#5f8442', '#9bb06a', '#b2a26a', '#4f7a3a', '#7d9a4e'];
  for (let i = 0; i < 260; i++) {
    g.save();
    g.translate(rnd() * 1024, rnd() * 1024);
    g.rotate((rnd() - 0.5) * 0.8);
    g.fillStyle = fields[Math.floor(rnd() * fields.length)];
    g.fillRect(0, 0, 30 + rnd() * 110, 20 + rnd() * 80);
    g.restore();
  }
  // Bush and trees in clumps
  for (let i = 0; i < 1600; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(40,74,32,0.55)' : 'rgba(58,92,40,0.5)';
    g.beginPath();
    g.arc(rnd() * 1024, rnd() * 1024, 2 + rnd() * 6, 0, Math.PI * 2);
    g.fill();
  }
  // Red-earth tracks
  g.strokeStyle = 'rgba(176,110,70,0.75)';
  g.lineWidth = 3;
  for (let i = 0; i < 9; i++) {
    g.beginPath();
    let x = rnd() * 1024;
    let y = 0;
    g.moveTo(x, y);
    while (y < 1024) { x += (rnd() - 0.5) * 120; y += 60 + rnd() * 80; g.lineTo(x, y); }
    g.stroke();
  }
  // Small compounds: roofs of zinc and tile
  for (let i = 0; i < 140; i++) {
    const x = rnd() * 1024;
    const y = rnd() * 1024;
    g.fillStyle = rnd() < 0.6 ? '#9ca3af' : '#a35a3a';
    g.fillRect(x, y, 4 + rnd() * 5, 3 + rnd() * 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function runwayTexture(): THREE.CanvasTexture {
  const W = 256;
  const H = 4096;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#3a3f45';
  g.fillRect(0, 0, W, H);
  // Tyre marks in the touchdown zones
  g.fillStyle = 'rgba(15,15,15,0.35)';
  for (const y0 of [H - 600, 120]) for (let k = 0; k < 40; k++) g.fillRect(70 + Math.random() * 116, y0 + Math.random() * 480, 6, 30 + Math.random() * 80);
  g.fillStyle = '#f4f4f5';
  // Edge lines and the centre line
  g.fillRect(6, 0, 4, H);
  g.fillRect(W - 10, 0, 4, H);
  for (let y = 120; y < H - 120; y += 82) g.fillRect(W / 2 - 2, y, 4, 49);
  // Threshold bars, numbers, touchdown and aiming point marks at both ends
  const end = (flip: boolean, number: string) => {
    const at = (y: number) => (flip ? y : H - y);
    for (let i = 0; i < 8; i++) {
      const x = 16 + i * 14 + (i >= 4 ? 52 : 0);
      g.fillRect(x, flip ? at(8) : at(8) - 40, 8, 40);
    }
    g.save();
    g.translate(W / 2, at(90));
    if (flip) g.rotate(Math.PI);
    g.font = 'bold 34px sans-serif';
    g.textAlign = 'center';
    g.fillText(number, 0, 12);
    g.restore();
    for (const y of [200, 290]) for (const x of [40, W - 62]) g.fillRect(x, flip ? at(y) : at(y) - 26, 22, 26);
    for (const x of [30, W - 78]) g.fillRect(x, flip ? at(380) : at(380) - 60, 48, 60);
  };
  end(false, '18R');
  end(true, '36L');
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function terminalTexture(name: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0f3d2a';
  g.fillRect(0, 0, 1024, 128);
  g.fillStyle = '#ffffff';
  g.font = '700 54px "Righteous", "Segoe UI", sans-serif';
  g.textAlign = 'center';
  g.fillText(name.toUpperCase(), 512, 82, 990);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function glassTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, '#9ec9e8');
  grad.addColorStop(1, '#3a6f96');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#e5e7eb';
  for (let x = 0; x < 256; x += 16) g.fillRect(x, 0, 2, 64);
  g.fillRect(0, 30, 256, 2);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A flat strip following a path, for taxiways and roads */
function ribbon(points: THREE.Vector3[], width: number, y: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(points.length - 1, i + 1)];
    const dir = new THREE.Vector3().subVectors(b, a).setY(0).normalize();
    const side = new THREE.Vector3(dir.z, 0, -dir.x).multiplyScalar(width / 2);
    pos.push(points[i].x + side.x, y, points[i].z + side.z, points[i].x - side.x, y, points[i].z - side.z);
    if (i > 0) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const flat = (hex: number, offset: number) => new THREE.MeshLambertMaterial({ color: hex, polygonOffset: true, polygonOffsetFactor: -offset, polygonOffsetUnits: -offset * 4, side: THREE.DoubleSide });

export class FlightWorld {
  /** Everything outside the aircraft; the scene it is drawn in gets the fog and the background */
  public readonly root = new THREE.Group();
  private readonly scene: THREE.Scene;
  public readonly airport = new THREE.Group();
  private arrival: THREE.Group | null = null;
  private arrivalSign: THREE.MeshBasicMaterial | null = null;
  private readonly sky: THREE.Mesh;
  private readonly skyUniforms = { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, white: { value: 0 } };
  private readonly sun: THREE.DirectionalLight;
  private readonly hemi: THREE.HemisphereLight;
  private readonly sunDisc: THREE.Sprite;
  private readonly clouds: THREE.InstancedMesh;
  private readonly cloudPuffs: Array<{ p: THREE.Vector3; s: number }> = [];
  private readonly cloudOrder: number[] = [];
  private readonly fog: THREE.Fog;
  private readonly lightsMaterial: THREE.MeshBasicMaterial;
  private readonly water: THREE.Mesh;
  private readonly signMaterial: THREE.MeshBasicMaterial;
  private readonly bridge = new THREE.Group();
  private readonly tug = new THREE.Group();
  private light: Light = 'day';
  /** Where the airport being built stands along the way (the departure one is at 0) */
  private readonly arrivalZ: number;
  private sortTimer = 0;
  /** The rivers' lines and half-widths, kept clear of buildings */
  private readonly rivers: Array<{ pts: THREE.Vector3[]; half: number }> = [];
  private palette = PALETTE.day;

  constructor(routeLength: number, arrivalZ: number, scene: THREE.Scene) {
    this.scene = scene;
    this.arrivalZ = arrivalZ;
    this.fog = new THREE.Fog(0xcfe3f5, 2500, 14000);
    this.scene.fog = this.fog;
    this.scene.background = new THREE.Color(0xcfe3f5);

    // The sky: a dome that goes with the camera
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(16000, 32, 16), new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 horizon; uniform float white; varying vec3 vDir; void main(){ float h = clamp(vDir.y * 1.6, 0.0, 1.0); vec3 c = mix(horizon, top, pow(h, 0.7)); if (vDir.y < 0.0) c = horizon; gl_FragColor = vec4(mix(c, vec3(0.93,0.95,0.97), white), 1.0); }',
    }));
    this.sky.renderOrder = -10;
    this.root.add(this.sky);
    this.sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff7d6, fog: false, depthWrite: false, blending: THREE.AdditiveBlending, transparent: true }));
    this.sunDisc.scale.set(2200, 2200, 1);
    this.root.add(this.sunDisc);
    this.hemi = new THREE.HemisphereLight(0xdbeafe, 0x6b8e4e, 1.25);
    this.root.add(this.hemi);
    this.root.add(new THREE.AmbientLight(0xffffff, 0.45));
    this.sun = new THREE.DirectionalLight(0xfffbeb, 2.6);
    this.root.add(this.sun);
    this.root.add(this.sun.target);

    // The country: farmland repeated, tinted in broad patches so the repeat does not show
    const size = 80000;
    const groundGeo = new THREE.PlaneGeometry(size, size, 48, 48);
    groundGeo.rotateX(-Math.PI / 2);
    const colours: number[] = [];
    const p = groundGeo.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const n = 0.82 + 0.12 * Math.sin(x * 0.00031 + z * 0.00017) + 0.08 * Math.sin(z * 0.00071 - x * 0.0004);
      colours.push(n * 1.0, n * (0.98 + 0.05 * Math.sin(z * 0.0002)), n * 0.92);
    }
    groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
    const farm = farmlandTexture();
    farm.repeat.set(size / 2600, size / 2600);
    const ground = new THREE.Mesh(groundGeo, new THREE.MeshLambertMaterial({ map: farm, vertexColors: true }));
    ground.position.set(0, -0.5, routeLength / 2);
    this.root.add(ground);

    // Rivers across the way: wide and brown-green, winding
    const riverMat = new THREE.MeshPhongMaterial({ color: 0x4f7f8f, shininess: 60, specular: 0x8fb8c8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8, side: THREE.DoubleSide });
    for (const [z0, w, tilt] of [[routeLength * 0.4, 300, 0.12], [routeLength * 0.6, 420, -0.1]] as Array<[number, number, number]>) {
      const pts: THREE.Vector3[] = [];
      for (let k = -40; k <= 40; k++) {
        const along = k * 500;
        pts.push(new THREE.Vector3(along, 0, z0 + along * tilt * 0.4 + Math.sin(k * 0.7) * 400 + Math.sin(k * 0.23) * 800));
      }
      this.rivers.push({ pts, half: w / 2 + 60 });
      const river = new THREE.Mesh(ribbon(pts, w, 0.6), riverMat);
      this.root.add(river);
    }

    // Towns and villages along the way: patches of roofs, seen as grey speckle from the cruise
    this.root.add(this.buildTowns(routeLength));

    // The cloud deck, and a few puffs at the cruise to rush past
    const puffs: Array<{ p: THREE.Vector3; s: number }> = [];
    let seed = 5;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 64; i++) {
      const cx = (rnd() - 0.5) * 9000;
      const cz = -3000 + rnd() * (routeLength + 6000);
      const cy = 620 + rnd() * 260;
      const n = 4 + Math.floor(rnd() * 4);
      for (let k = 0; k < n; k++) puffs.push({ p: new THREE.Vector3(cx + (rnd() - 0.5) * 520, cy + rnd() * 140, cz + (rnd() - 0.5) * 520), s: 220 + rnd() * 340 });
    }
    // Clouds on the line of the climb and descent, so the aircraft goes through them
    for (const z of [1300, 1700, routeLength - 2600, routeLength - 2100]) {
      for (let k = 0; k < 6; k++) puffs.push({ p: new THREE.Vector3((rnd() - 0.5) * 300, 640 + rnd() * 200, z + (rnd() - 0.5) * 400), s: 260 + rnd() * 200 });
    }
    for (let i = 0; i < 36; i++) puffs.push({ p: new THREE.Vector3((rnd() - 0.5) * 1600, CRUISE_ALTITUDE + (rnd() - 0.3) * 260, rnd() * routeLength), s: 120 + rnd() * 220 });
    this.cloudPuffs.push(...puffs);
    puffs.forEach((_, i) => this.cloudOrder.push(i));
    this.clouds = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 0.62), new THREE.MeshBasicMaterial({ map: cloudTexture(), transparent: true, depthWrite: false, fog: true, color: 0xffffff }), puffs.length);
    this.clouds.frustumCulled = false;
    this.clouds.renderOrder = 2;
    this.root.add(this.clouds);

    // The airport
    this.lightsMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.signMaterial = new THREE.MeshBasicMaterial({ map: terminalTexture('Murtala Muhammed International Airport') });
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(9000, 6000), new THREE.MeshPhongMaterial({ color: 0x3f7f99, shininess: 80, specular: 0x9ccbe0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }));
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(6200, 0.4, 1500);
    this.water.name = 'water';
    this.buildAirport();
    this.root.add(this.airport);
  }

  /** Is this point in a river, or on its bank? */
  private inRiver(x: number, z: number): boolean {
    for (const r of this.rivers) {
      const k = Math.round(x / 500) + 40;
      for (const i of [k - 1, k, k + 1]) {
        const a = r.pts[i];
        const b = r.pts[i + 1];
        if (!a || !b) continue;
        const ab = b.clone().sub(a);
        const t = THREE.MathUtils.clamp(((x - a.x) * ab.x + (z - a.z) * ab.z) / ab.lengthSq(), 0, 1);
        const dx = a.x + ab.x * t - x;
        const dz = a.z + ab.z * t - z;
        if (dx * dx + dz * dz < r.half * r.half) return true;
      }
    }
    return false;
  }

  private buildTowns(routeLength: number): THREE.Object3D {
    const group = new THREE.Group();
    const box = new THREE.BoxGeometry(1, 1, 1);
    box.translate(0, 0.5, 0);
    const towns: Array<{ x: number; z: number; r: number }> = [];
    let seed = 17;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let z = 3500; z < routeLength - 3500; z += 1400 + rnd() * 1800) {
      towns.push({ x: (rnd() < 0.5 ? -1 : 1) * (500 + rnd() * 4500), z, r: 220 + rnd() * 520 });
    }
    const perTown = 70;
    const roofs = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial({ color: 0xffffff }), towns.length * perTown);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const roofColours = [0x9ca3af, 0xa35a3a, 0xd1d5db, 0x7c5a44, 0xb0b7c0, 0x8f4b32];
    let i = 0;
    for (const t of towns) {
      for (let k = 0; k < perTown; k++) {
        const a = rnd() * Math.PI * 2;
        const d = Math.sqrt(rnd()) * t.r;
        const w = 12 + rnd() * 22;
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI);
        const at = new THREE.Vector3(t.x + Math.cos(a) * d, 0, t.z + Math.sin(a) * d);
        // In a river, the house is not built: it is put out of sight under the ground
        const wet = this.inRiver(at.x, at.z);
        m.compose(at.setY(wet ? -60 : 0), q, new THREE.Vector3(w, 4 + rnd() * 10, w * (0.6 + rnd() * 0.6)));
        roofs.setMatrixAt(i, m);
        roofs.setColorAt(i, new THREE.Color(roofColours[Math.floor(rnd() * roofColours.length)]));
        i++;
      }
    }
    roofs.instanceMatrix.needsUpdate = true;
    if (roofs.instanceColor) roofs.instanceColor.needsUpdate = true;
    group.add(roofs);
    // Under each town, the dust of its streets
    const patch = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), flat(0xa08a6e, 1), towns.length);
    towns.forEach((t, k) => { m.compose(new THREE.Vector3(t.x, 0.3, t.z), new THREE.Quaternion(), new THREE.Vector3(t.r * 1.15, 1, t.r * 1.15)); patch.setMatrixAt(k, m); });
    patch.instanceMatrix.needsUpdate = true;
    group.add(patch);
    // A road from town to town
    const road = ribbon(towns.map((t) => new THREE.Vector3(t.x * 0.6, 0, t.z)), 14, 0.5);
    group.add(new THREE.Mesh(road, flat(0x55524e, 2)));
    return group;
  }

  private buildAirport(): void {
    const a = this.airport;
    // Grass inside the fence, the runway, the parallel taxiway, the apron
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(1500, 4200), flat(0x7d9c57, 1));
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(-150, 0.1, 1500);
    a.add(grass);
    const runway = new THREE.Mesh(new THREE.PlaneGeometry(45, 3000), new THREE.MeshLambertMaterial({ map: runwayTexture(), polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -12 }));
    runway.rotation.x = -Math.PI / 2;
    runway.position.set(0, 0.2, 1500);
    a.add(runway);
    const asphalt = flat(0x4a4f55, 2);
    const taxi = new THREE.Mesh(new THREE.PlaneGeometry(23, 3000), asphalt);
    taxi.rotation.x = -Math.PI / 2;
    taxi.position.set(-168, 0.15, 1500);
    a.add(taxi);
    const pts = taxiOutCurve.getSpacedPoints(60);
    a.add(new THREE.Mesh(ribbon(pts, 24, 0.16), asphalt));
    a.add(new THREE.Mesh(ribbon(pts, 0.5, 0.22), flat(0xfacc15, 4)));
    for (const z of [600, 1300, 2000, 2700]) a.add(new THREE.Mesh(ribbon([new THREE.Vector3(-168, 0, z - 40), new THREE.Vector3(-90, 0, z + 20), new THREE.Vector3(-20, 0, z + 90)], 23, 0.15), asphalt));
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(170, 640), flat(0xa7acb2, 2));
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(-215, 0.17, 320);
    a.add(apron);
    // Stand lead-in lines
    for (const z of [140, 260, 380, 500]) a.add(new THREE.Mesh(ribbon([new THREE.Vector3(-150, 0, z - 30), new THREE.Vector3(-200, 0, z), new THREE.Vector3(-262, 0, z)], 0.4, 0.24), flat(0xfacc15, 4)));

    // The terminal along the apron, its sign, the tower, hangars
    const b = new Builder();
    b.box(0xe5e7eb, 46, 16, 620, -322, 0, 320);
    b.box(0xd1d5db, 52, 1.6, 630, -322, 16, 320);
    b.box(0x94a3b8, 30, 6, 200, -360, 0, 760);
    b.cylinder(0xe5e7eb, 4.5, 52, -380, 0, 40, { sides: 16 });
    b.cylinder(0x1e293b, 9, 6, -380, 52, 40, { sides: 16 });
    b.cylinder(0xe5e7eb, 9.5, 1.2, -380, 58, 40, { sides: 16 });
    for (const z of [980, 1100, 1220]) { b.box(0xcbd5e1, 70, 22, 90, -330, 0, z); b.box(0x64748b, 72, 2, 92, -330, 22, z); }
    // City blocks round the airport: the way Lagos comes right up to the fence
    let seed = 23;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    a.add(b.build('terminal', { roughness: 0.7 }));
    const blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshLambertMaterial({ color: 0xffffff }), 1700);
    const m = new THREE.Matrix4();
    const colours = [0xe7e5e4, 0xd6d3d1, 0xfde68a, 0xfecaca, 0xbfdbfe, 0xa8a29e, 0x9ca3af, 0xf5f5f4];
    let n = 0;
    while (n < 1700) {
      const x = -4500 + rnd() * 8500;
      const z = -3500 + rnd() * 9500;
      // The airport itself, the lines of approach and the rivers stay clear
      if (x > -900 && x < 520 && z > -900 && z < 3900) continue;
      if (Math.abs(x) < 260) continue;
      if (this.inRiver(x, z) || this.inRiver(x, z + this.arrivalZ)) continue;
      const w = 14 + rnd() * 26;
      const tall = rnd() < 0.06 ? 40 + rnd() * 90 : 5 + rnd() * 14;
      m.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.round(rnd() * 3) * 0.12), new THREE.Vector3(w, tall, w * (0.6 + rnd() * 0.8)));
      blocks.setMatrixAt(n, m);
      blocks.setColorAt(n, new THREE.Color(colours[Math.floor(rnd() * colours.length)]));
      n++;
    }
    blocks.instanceMatrix.needsUpdate = true;
    if (blocks.instanceColor) blocks.instanceColor.needsUpdate = true;
    a.add(blocks);
    a.add(new THREE.Mesh(ribbon([new THREE.Vector3(-420, 0, -2500), new THREE.Vector3(-400, 0, 320), new THREE.Vector3(-700, 0, 4200)], 22, 0.3), flat(0x3f3f46, 2)));

    const glass = new THREE.Mesh(new THREE.PlaneGeometry(620, 12), new THREE.MeshLambertMaterial({ map: glassTexture() }));
    (glass.material as THREE.MeshLambertMaterial).map!.repeat.set(30, 1);
    glass.position.set(-298.9, 8, 320);
    glass.rotation.y = Math.PI / 2;
    a.add(glass);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(160, 20), this.signMaterial);
    sign.name = 'terminal sign';
    sign.position.set(-298.5, 27, 320);
    sign.rotation.y = Math.PI / 2;
    a.add(sign);
    const signBack = new THREE.Mesh(new THREE.BoxGeometry(2, 22, 164), new THREE.MeshLambertMaterial({ color: 0x0f3d2a }));
    signBack.position.set(-300, 27, 320);
    a.add(signBack);

    // Jet bridges: the one on the player's stand pulls back; the others are on their aircraft
    const bridgeMat = new THREE.MeshLambertMaterial({ color: 0xb8c0c8 });
    const makeBridge = () => {
      const g = new THREE.Group();
      const rotunda = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 4, 14), bridgeMat);
      rotunda.position.set(0, 5, 0);
      g.add(rotunda);
      const tube = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3, 40), bridgeMat);
      body.position.set(0, 5, 20);
      tube.add(body);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4, 0.6), new THREE.MeshLambertMaterial({ color: 0x475569 }));
      leg.position.set(0, 2, 30);
      tube.add(leg);
      g.add(tube);
      g.userData.tube = tube;
      return g;
    };
    this.bridge.add(makeBridge());
    // The rotunda stands off the terminal; the tube reaches the front left door
    const door = new THREE.Vector3(STAND.position.x - 13.0, 0, STAND.position.z + 2.1);
    const rot = new THREE.Vector3(-296, 0, STAND.position.z + 26);
    this.bridge.position.copy(rot);
    const reach = door.clone().sub(rot);
    this.bridge.rotation.y = Math.atan2(reach.x, reach.z);
    this.bridge.userData.reach = reach.length();
    a.add(this.bridge);
    for (const [z, tail] of [[260, 0x1d4ed8], [380, 0xb91c1c], [500, 0x7c3aed]] as Array<[number, number]>) {
      const parked = Airliner.parked(tail);
      parked.position.set(STAND.position.x, 0, z);
      parked.rotation.y = STAND.yaw;
      a.add(parked);
      const other = makeBridge();
      const d = new THREE.Vector3(STAND.position.x - 13.0, 0, z + 2.1);
      const r = new THREE.Vector3(-296, 0, z + 26);
      other.position.copy(r);
      other.rotation.y = Math.atan2(d.x - r.x, d.z - r.z);
      const tube = other.userData.tube as THREE.Group;
      tube.scale.z = d.distanceTo(r) / 40;
      a.add(other);
    }
    // The pushback tug, and the baggage carts and a fuel truck by the stand
    const gse = new Builder();
    gse.box(0xfacc15, 2.6, 1.3, 5.2, 0, 0, 0);
    gse.box(0x111827, 2.2, 0.9, 1.6, 0, 1.3, -1.2);
    this.tug.add(gse.build('tug'));
    a.add(this.tug);
    const carts = new Builder();
    for (let k = 0; k < 4; k++) carts.box(0x64748b, 1.6, 1.4, 2.6, -205 + k * 3.2, 0, 160);
    carts.box(0xf1f5f9, 2.5, 2.8, 9, -190, 0, 106);
    carts.cylinder(0xe5e7eb, 1.1, 6.5, -190, 1.4, 104, { sides: 12 });
    a.add(carts.build('ground vehicles'));

    // Lights: runway edges, threshold green, end red, the approach bars, the PAPI
    const lights: Array<[number, number, number, number]> = [];
    for (let z = 0; z <= 3000; z += 60) { lights.push([-23, 0.4, z, 0xfefce8]); lights.push([23, 0.4, z, 0xfefce8]); }
    for (let x = -21; x <= 21; x += 3) { lights.push([x, 0.4, -1, 0x22c55e]); lights.push([x, 0.4, 3001, 0xef4444]); }
    for (let z = -60; z >= -900; z -= 60) for (let x = -12; x <= 12; x += 4) lights.push([x, 2 + (-z) * 0.01, z, 0xffffff]);
    for (let k = 0; k < 4; k++) lights.push([-34 - k * 9, 0.8, 340, k < 2 ? 0xffffff : 0xef4444]);
    for (let z = 0; z <= 3000; z += 45) { lights.push([-180, 0.4, z, 0x3b82f6]); lights.push([-156, 0.4, z, 0x3b82f6]); }
    const lightGeo = new THREE.SphereGeometry(0.7, 6, 4);
    const lamp = new THREE.InstancedMesh(lightGeo, this.lightsMaterial, lights.length);
    lights.forEach(([x, y, z, hex], k) => { m.makeTranslation(x, y, z); lamp.setMatrixAt(k, m); lamp.setColorAt(k, new THREE.Color(hex)); });
    lamp.instanceMatrix.needsUpdate = true;
    if (lamp.instanceColor) lamp.instanceColor.needsUpdate = true;
    lamp.name = 'airport lights';
    a.add(lamp);
    a.add(this.water);
  }

  /**
   * The airport at each end: the departure one where the runway starts, and a copy of it put
   * down where the descent ends, each with its own name over the terminal and the water by it
   * if the city is on the coast.
   */
  public placeAirports(from: string, fromCoastal: boolean, arrivalZ: number, to: string, toCoastal: boolean): void {
    this.signMaterial.map?.dispose();
    this.signMaterial.map = terminalTexture(from);
    this.signMaterial.needsUpdate = true;
    this.water.visible = fromCoastal;
    if (!this.arrival) {
      this.arrival = this.airport.clone(true);
      this.arrivalSign = new THREE.MeshBasicMaterial();
      const sign = this.arrival.getObjectByName('terminal sign') as THREE.Mesh | undefined;
      if (sign) sign.material = this.arrivalSign;
      this.root.add(this.arrival);
    }
    this.arrival.position.set(0, 0, arrivalZ);
    this.arrivalSign!.map?.dispose();
    this.arrivalSign!.map = terminalTexture(to);
    this.arrivalSign!.needsUpdate = true;
    const water = this.arrival.getObjectByName('water');
    if (water) water.visible = toCoastal;
  }

  /** Pulls the jet bridge back from the door (1 on the door, 0 back) and puts the tug at the nose */
  public setGround(bridge: number, tug: boolean, nose: THREE.Vector3, yaw: number): void {
    const tube = (this.bridge.children[0].userData.tube as THREE.Group);
    const reach = this.bridge.userData.reach as number;
    tube.scale.z = THREE.MathUtils.lerp(reach * 0.72, reach, bridge) / 40;
    this.tug.visible = tug || bridge < 1;
    if (tug) {
      this.tug.position.copy(nose).sub(this.airport.position);
      this.tug.rotation.y = yaw;
    }
  }

  public setLight(light: Light): void {
    this.light = light;
    const p = PALETTE[light];
    this.palette = p;
    this.skyUniforms.top.value.set(p.top);
    this.skyUniforms.horizon.value.set(p.horizon);
    this.fog.color.set(p.fog);
    (this.scene.background as THREE.Color).set(p.fog);
    this.hemi.color.set(p.hemi[0]);
    this.hemi.groundColor.set(p.hemi[1]);
    this.hemi.intensity = p.hemi[2];
    this.sun.color.set(p.sun);
    this.sun.intensity = p.sunLevel;
    (this.sunDisc.material as THREE.SpriteMaterial).color.set(p.sun);
    // At night the lamps glow brighter, the towns show their lights
    this.lightsMaterial.color.setScalar(light === 'night' ? 1.6 : light === 'dusk' ? 1.2 : 0.9);
  }

  /**
   * Every frame: the sky round the camera, the clouds turned to face it and drawn far to near,
   * and the whiteout when the camera is inside a cloud.
   */
  public update(delta: number, camera: THREE.Camera): void {
    const eye = camera.getWorldPosition(new THREE.Vector3());
    this.sky.position.copy(eye);
    const sunDir = this.palette.sunAt.clone().normalize();
    this.sunDisc.position.copy(eye).addScaledVector(sunDir, 14000);
    this.sun.position.copy(eye).addScaledVector(sunDir, 800);
    this.sun.target.position.copy(eye);
    // How deep in cloud the eye is
    let inside = 0;
    for (const c of this.cloudPuffs) {
      const d = c.p.distanceTo(eye) / (c.s * 0.42);
      if (d < 1) inside = Math.max(inside, 1 - d);
    }
    const white = THREE.MathUtils.clamp(inside * 1.8, 0, 1);
    this.skyUniforms.white.value = white;
    this.fog.near = THREE.MathUtils.lerp(2500, 0, white);
    this.fog.far = THREE.MathUtils.lerp(eye.y > 300 ? 16000 : 11000, 90, white);
    this.fog.color.set(this.palette.fog).lerp(new THREE.Color(0xeef2f6), white);
    // Far to near, every so often, so the near puffs are drawn over the far
    this.sortTimer -= delta;
    if (this.sortTimer <= 0) {
      this.sortTimer = 0.25;
      this.cloudOrder.sort((i, j) => this.cloudPuffs[j].p.distanceToSquared(eye) - this.cloudPuffs[i].p.distanceToSquared(eye));
    }
    const q = camera.getWorldQuaternion(new THREE.Quaternion());
    const m = new THREE.Matrix4();
    const scale = new THREE.Vector3();
    this.cloudOrder.forEach((i, k) => {
      const c = this.cloudPuffs[i];
      scale.set(c.s, c.s, c.s);
      m.compose(c.p, q, scale);
      this.clouds.setMatrixAt(k, m);
    });
    this.clouds.instanceMatrix.needsUpdate = true;
    void this.light;
  }
}
