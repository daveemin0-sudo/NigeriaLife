import * as THREE from 'three';
import type { InteractiveObject } from '../world/World';
import type { HomePlan } from './HomePlan';
import { PlaceActions } from '../destinations/PlaceActions';
import { Dues, dayLabel, type LeaseView } from '../life/Dues';

export const QUIT_NOTICE_ID = 'home_quit_notice';

/**
 * The landlord's quit notice, pinned on the wall inside the front door of a rented home when the
 * rent is not paid (src/life/Dues.ts). It says what is owed and by when. Walked up to and read,
 * it offers to pay what is owed, which withdraws it; paid any other way, it comes down too.
 */
export class QuitNotice {
  private static mesh: THREE.Object3D | null = null;
  private static shownFor = '';
  private static home: { group: THREE.Group; plan: HomePlan; list: InteractiveObject[]; door: THREE.Object3D; notice: () => LeaseView | null } | null = null;
  private static listening = false;

  /** The home has been laid out: pins the notice if one is owed, or takes it down */
  public static sync(group: THREE.Group, plan: HomePlan, list: InteractiveObject[], door: THREE.Object3D, notice: () => LeaseView | null): void {
    QuitNotice.home = { group, plan, list, door, notice };
    if (!QuitNotice.listening) {
      QuitNotice.listening = true;
      // Served while the player is at home, or paid from the phone: the wall shows it at once
      Dues.get().subscribe(() => QuitNotice.refresh());
    }
    QuitNotice.refresh();
  }

  /** Whether a notice is up on the wall now, and what it says (for tests) */
  public static shown(): { owed: number; deadline: string; visible: boolean } | null {
    const mesh = QuitNotice.mesh;
    if (!mesh || !mesh.parent) return null;
    return { ...(mesh.userData.notice as { owed: number; deadline: string }), visible: mesh.visible };
  }

  private static refresh(): void {
    const home = QuitNotice.home;
    if (!home) return;
    const lease = home.notice();
    const key = lease && lease.deadline !== null ? `${lease.propId}|${lease.arrears}|${lease.deadline}` : '';
    if (key === QuitNotice.shownFor && (!key || !!QuitNotice.mesh?.parent)) return;
    QuitNotice.takeDown();
    QuitNotice.shownFor = key;
    if (!lease || lease.deadline === null) return;

    const { plan, group, list, door } = home;
    // Pasted on the front door, as landlords do: one sheet read from the street side (where the
    // camera looks in from, over the low front wall) and one from inside. It swings with the door.
    const leaf = door.getObjectByName('hinged_door')?.children[0] ?? door;
    const material = new THREE.MeshBasicMaterial({ map: QuitNotice.paper(lease), toneMapped: false });
    const geometry = new THREE.PlaneGeometry(0.62, 0.86);
    const outside = new THREE.Mesh(geometry, material);
    outside.position.set(0, 0, -0.04);
    outside.rotation.y = Math.PI;
    const inside = new THREE.Mesh(geometry, material);
    inside.position.set(0, 0, 0.04);
    const mesh = new THREE.Group();
    mesh.name = QUIT_NOTICE_ID;
    mesh.position.set(0.75, 1.55, 0);
    mesh.add(outside, inside);
    mesh.userData.notice = { owed: lease.arrears, deadline: dayLabel(lease.deadline) };
    mesh.userData.parts = { geometry, material };
    leaf.add(mesh);
    QuitNotice.mesh = mesh;

    const origin = group.position;
    const stand = new THREE.Vector3(origin.x + plan.entrance.x + 0.4, 0, origin.z + plan.frontZ - 1.2);
    const at = new THREE.Vector3();
    mesh.getWorldPosition(at);
    list.push({ mesh, id: QUIT_NOTICE_ID, name: 'Quit notice', category: 'From your landlord', description: `Rent owed on ${lease.name}.`, interactionPoint: stand });
    PlaceActions.register(QUIT_NOTICE_ID, {
      label: () => `📜 Quit notice: ₦${lease.arrears.toLocaleString()} owed by ${dayLabel(lease.deadline!)}`,
      run: (host) => {
        host.director.perform({
          id: 'read the quit notice',
          actor: host.actor,
          point: stand,
          target: at,
          animation: { arms: 'reach' },
          seconds: 1.4,
          effectAt: 0.7,
          ifStuck: 'snap',
          effect: () => {
            host.ask({
              who: 'Alhaji Lateef',
              role: `Landlord, ${lease.name}`,
              text: `QUIT NOTICE. You owe ₦${lease.arrears.toLocaleString()} in rent. Pay it, with next Saturday's rent of ₦${lease.weekly.toLocaleString()}, before ${dayLabel(lease.deadline!)}, or the locks will be changed.`,
              choices: [
                {
                  label: `Send him ₦${lease.arrears.toLocaleString()} now`,
                  note: 'From your bank, then your cash',
                  pick: () => {
                    const paid = Dues.get().payRentOwed(lease.propId);
                    host.say(paid.message, paid.ok ? 'success' : 'warning');
                  },
                },
                { label: 'Leave it on the wall', pick: () => undefined },
              ],
            });
            return true;
          },
        });
      },
    });
  }

  private static takeDown(): void {
    const mesh = QuitNotice.mesh;
    QuitNotice.mesh = null;
    PlaceActions.unregister(QUIT_NOTICE_ID);
    const list = QuitNotice.home?.list;
    if (list) {
      const i = list.findIndex((o) => o.id === QUIT_NOTICE_ID);
      if (i >= 0) list.splice(i, 1);
    }
    if (!mesh) return;
    mesh.parent?.remove(mesh);
    const { geometry, material } = mesh.userData.parts as { geometry: THREE.BufferGeometry; material: THREE.MeshBasicMaterial };
    geometry.dispose();
    material.map?.dispose();
    material.dispose();
  }

  /** A sheet of paper: the heading in red, what is owed, by when, and the landlord's name */
  private static paper(lease: LeaseView): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 360;
    c.height = 500;
    const g = c.getContext('2d')!;
    g.fillStyle = '#fbf7ec';
    g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = '#c9bfa6';
    g.lineWidth = 6;
    g.strokeRect(10, 10, c.width - 20, c.height - 20);
    g.textAlign = 'center';
    g.fillStyle = '#b91c1c';
    g.font = 'bold 46px sans-serif';
    g.fillText('QUIT NOTICE', c.width / 2, 78);
    g.fillStyle = '#1f2937';
    g.font = '22px sans-serif';
    const lines = [
      'To the occupant of',
      lease.name.length > 26 ? `${lease.name.slice(0, 25)}…` : lease.name,
      '',
      'Rent owed',
      `₦${lease.arrears.toLocaleString()}`,
      '',
      'Pay it, and the next rent,',
      `before ${dayLabel(lease.deadline!)}`,
      'or the locks will be changed.',
    ];
    lines.forEach((line, i) => {
      g.font = i === 4 ? 'bold 40px sans-serif' : i === 7 ? 'bold 26px sans-serif' : '22px sans-serif';
      g.fillText(line, c.width / 2, 140 + i * 34);
    });
    g.font = 'italic 24px serif';
    g.fillText('— Alhaji Lateef, Landlord', c.width / 2, c.height - 44);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
}
