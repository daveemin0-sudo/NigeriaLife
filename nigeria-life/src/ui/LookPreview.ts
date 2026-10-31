import * as THREE from 'three';
import type { CharacterConfig } from '../player/CharacterCustomization';
import { createHumanForConfig } from '../player/HumanFromConfig';

/**
 * A studio photograph of a look, for the look editor: the person full length and their face
 * close, in soft daylight on a plain backdrop, taken with the game's own renderer between frames.
 */
export const LookPreview = {
  renderer: null as THREE.WebGLRenderer | null,
  scene: null as THREE.Scene | null,

  shoot(config: CharacterConfig): { full: string; face: string } | null {
    const renderer = this.renderer;
    if (!renderer) return null;
    if (!this.scene) {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xeef2ef);
      const key = new THREE.DirectionalLight(0xffffff, 1.7);
      key.position.set(1.5, 3, 4);
      const rim = new THREE.DirectionalLight(0xfff1dc, 0.8);
      rim.position.set(-2, 2.5, -2);
      scene.add(key, rim, new THREE.HemisphereLight(0xffffff, 0xb8a894, 1.0));
      const floor = new THREE.Mesh(new THREE.CircleGeometry(1.4, 40), new THREE.MeshStandardMaterial({ color: 0xd9dfda, roughness: 0.9 }));
      floor.rotation.x = -Math.PI / 2;
      scene.add(floor);
      this.scene = scene;
    }
    const scene = this.scene;
    const rig = createHumanForConfig({ ...config, name: '' });
    rig.nameTag.visible = false;
    rig.updateAnimation(0.4, false);
    rig.group.rotation.y = -0.25;
    scene.add(rig.group);
    const canvas = renderer.domElement;
    const size = renderer.getSize(new THREE.Vector2());
    const ratio = renderer.getPixelRatio();
    // A 3 : 4 corner of the canvas, as big as fits
    const w = Math.floor(Math.min(size.x, size.y * 0.75));
    const h = Math.floor(w / 0.75);
    const female = config.gender === 'female';
    const cam = new THREE.PerspectiveCamera(26, 0.75, 0.05, 50);
    const out = document.createElement('canvas');
    out.width = Math.round(w * ratio);
    out.height = Math.round(h * ratio);
    const ctx = out.getContext('2d')!;
    const snap = (eyeY: number, lookY: number, distance: number, viewHeight: number) => {
      cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(viewHeight / 2 / distance));
      cam.updateProjectionMatrix();
      cam.position.set(0.05, eyeY, distance);
      cam.lookAt(0, lookY, 0);
      const target = renderer.getRenderTarget();
      const viewport = renderer.getViewport(new THREE.Vector4());
      const scissor = renderer.getScissor(new THREE.Vector4());
      const scissorOn = renderer.getScissorTest();
      renderer.setRenderTarget(null);
      renderer.setViewport(0, size.y - h, w, h);
      renderer.setScissor(0, size.y - h, w, h);
      renderer.setScissorTest(true);
      renderer.render(scene, cam);
      // The canvas's top-left corner is where it was drawn
      ctx.drawImage(canvas, 0, 0, out.width, out.height, 0, 0, out.width, out.height);
      renderer.setViewport(viewport);
      renderer.setScissor(scissor);
      renderer.setScissorTest(scissorOn);
      renderer.setRenderTarget(target);
      return out.toDataURL('image/jpeg', 0.86);
    };
    const full = snap(1.1, 0.95, 4.2, 2.15);
    const faceY = female ? 1.6 : 1.68;
    const face = snap(faceY + 0.02, faceY - 0.01, 1.2, 0.42);
    scene.remove(rig.group);
    rig.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
    return { full, face };
  },
};
