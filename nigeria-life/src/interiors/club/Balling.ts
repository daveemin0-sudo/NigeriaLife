import * as THREE from 'three';

/**
 * Balling at the club: naira notes sprayed from the hands and fluttering down over the floor,
 * a champagne bottle popped at the table (the cork flying, the foam, the sparklers), and the
 * banner the whole club sees when someone big arrives.
 */

let noteTexture: THREE.CanvasTexture | null = null;
function noteMaterial(): THREE.MeshBasicMaterial {
  if (!noteTexture) {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 64;
    const g = c.getContext('2d')!;
    // A ₦1,000 note: brown and blue, with its value
    g.fillStyle = '#8b5a2b';
    g.fillRect(0, 0, 128, 64);
    g.fillStyle = '#1e3a8a';
    g.fillRect(0, 0, 36, 64);
    g.fillStyle = '#fde68a';
    g.font = 'bold 26px sans-serif';
    g.fillText('₦1000', 40, 42);
    noteTexture = new THREE.CanvasTexture(c);
    noteTexture.colorSpace = THREE.SRGBColorSpace;
  }
  return new THREE.MeshBasicMaterial({ map: noteTexture, side: THREE.DoubleSide });
}

interface Bit {
  mesh: THREE.Object3D;
  v: THREE.Vector3;
  spin: THREE.Vector3;
  life: number;
  drag: number;
}

export class Balling {
  private readonly parent: THREE.Object3D;
  private bits: Bit[] = [];
  private spraying: { from: () => THREE.Vector3; left: number; every: number; next: number } | null = null;
  private readonly noteGeo = new THREE.PlaneGeometry(0.22, 0.11);
  private readonly noteMat = noteMaterial();

  constructor(parent: THREE.Object3D) {
    this.parent = parent;
  }

  /** Notes leave the hands for this long, a fistful at a time; where the hands are is asked each time */
  public spray(from: () => THREE.Vector3, seconds: number): void {
    this.spraying = { from, left: seconds, every: 0.07, next: 0 };
  }

  private note(at: THREE.Vector3): void {
    const mesh = new THREE.Mesh(this.noteGeo, this.noteMat);
    mesh.position.copy(at);
    mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    this.parent.add(mesh);
    const a = Math.random() * Math.PI * 2;
    this.bits.push({ mesh, v: new THREE.Vector3(Math.cos(a) * (1 + Math.random() * 1.6), 2.2 + Math.random() * 1.8, Math.sin(a) * (1 + Math.random() * 1.6)), spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8), life: 6, drag: 1.8 });
  }

  /** A bottle popped at the table: the cork flies, the foam bursts, the sparklers burn */
  public pop(at: THREE.Vector3, colour: number): THREE.Group {
    const bottle = new THREE.Group();
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.36, 12), new THREE.MeshStandardMaterial({ color: colour, roughness: 0.2, metalness: 0.3 }));
    glass.position.y = 0.18;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 0.14, 10), new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.7, roughness: 0.3 }));
    neck.position.y = 0.43;
    bottle.add(glass, neck);
    bottle.position.copy(at);
    this.parent.add(bottle);
    // The cork
    const cork = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshStandardMaterial({ color: 0xa16207 }));
    cork.position.copy(at).add(new THREE.Vector3(0, 0.52, 0));
    this.parent.add(cork);
    this.bits.push({ mesh: cork, v: new THREE.Vector3(0.6, 5.5, 0.4), spin: new THREE.Vector3(9, 0, 7), life: 2.2, drag: 0.2 });
    // Foam and sparks
    const foam = new THREE.MeshBasicMaterial({ color: 0xfffbeb });
    const spark = new THREE.MeshBasicMaterial({ color: 0xfde047 });
    for (let i = 0; i < 28; i++) {
      const isSpark = i % 2 === 1;
      const bit = new THREE.Mesh(new THREE.SphereGeometry(isSpark ? 0.025 : 0.04, 6, 4), isSpark ? spark : foam);
      bit.position.copy(at).add(new THREE.Vector3(0, 0.5, 0));
      this.parent.add(bit);
      const a = Math.random() * Math.PI * 2;
      this.bits.push({ mesh: bit, v: new THREE.Vector3(Math.cos(a) * (isSpark ? 1.5 : 0.6), 1.6 + Math.random() * (isSpark ? 2.5 : 1.4), Math.sin(a) * (isSpark ? 1.5 : 0.6)), spin: new THREE.Vector3(), life: isSpark ? 1.4 : 1.1, drag: 0.6 });
    }
    // The bottle stays on the table a while, then is cleared away
    this.bits.push({ mesh: bottle, v: new THREE.Vector3(), spin: new THREE.Vector3(), life: 25, drag: 0 });
    return bottle;
  }

  public update(delta: number): void {
    if (this.spraying) {
      this.spraying.left -= delta;
      this.spraying.next -= delta;
      while (this.spraying.next <= 0) {
        this.spraying.next += this.spraying.every;
        const from = this.spraying.from();
        for (let i = 0; i < 3; i++) this.note(from);
      }
      if (this.spraying.left <= 0) this.spraying = null;
    }
    for (const bit of this.bits) {
      bit.life -= delta;
      if (bit.v.lengthSq() > 0 || bit.drag > 0) {
        bit.v.y -= 9.8 * delta * (bit.drag > 1 ? 0.25 : 1);
        bit.v.multiplyScalar(Math.max(0, 1 - bit.drag * delta * 0.5));
        bit.mesh.position.addScaledVector(bit.v, delta);
        if (bit.mesh.position.y < 0.02) {
          bit.mesh.position.y = 0.02;
          bit.v.set(0, 0, 0);
          bit.spin.set(0, 0, 0);
          bit.mesh.rotation.x = -Math.PI / 2;
        }
      }
      bit.mesh.rotation.x += bit.spin.x * delta;
      bit.mesh.rotation.y += bit.spin.y * delta;
      bit.mesh.rotation.z += bit.spin.z * delta;
    }
    for (const bit of this.bits.filter((b) => b.life <= 0)) bit.mesh.removeFromParent();
    this.bits = this.bits.filter((b) => b.life > 0);
  }

  /** How many notes are in the air or on the floor (for the test) */
  public get notes(): number {
    return this.bits.filter((b) => (b.mesh as THREE.Mesh).geometry === this.noteGeo).length;
  }
}

/** The banner across the screen when someone balls: gold, big, and gone in a few seconds */
export function celebrate(title: string, sub: string): void {
  document.getElementById('club-celebrate')?.remove();
  const el = document.createElement('div');
  el.id = 'club-celebrate';
  el.style.cssText = 'position:fixed;left:50%;top:22%;transform:translateX(-50%) scale(0.6);z-index:9000;padding:18px 26px;border-radius:18px;text-align:center;pointer-events:none;'
    + 'background:linear-gradient(135deg,#78350f,#d4af37 45%,#fde68a 55%,#b45309);box-shadow:0 0 40px rgba(250,204,21,0.8);color:#1c1917;font-family:var(--nl-font-display, "Righteous", sans-serif);transition:transform .35s cubic-bezier(.2,1.6,.4,1),opacity .4s;max-width:88vw;';
  el.innerHTML = `<div style="font-size:clamp(20px,5vw,34px);font-weight:900;letter-spacing:1px">${title}</div><div style="font-size:clamp(13px,3.4vw,17px);font-weight:700;margin-top:6px">${sub}</div><div style="font-size:26px;margin-top:4px">🍾 💸 🎉 💸 🍾</div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.transform = 'translateX(-50%) scale(1)'; });
  setTimeout(() => { el.style.opacity = '0'; }, 3400);
  setTimeout(() => el.remove(), 3900);
}
