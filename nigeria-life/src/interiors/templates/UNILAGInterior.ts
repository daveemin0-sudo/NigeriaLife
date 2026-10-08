import * as THREE from 'three';
import type { InteriorDefinition } from '../InteriorTypes';
import { InteriorPrefabs } from '../InteriorPrefabs';
import { InteriorNPCMesh } from '../InteriorNPCMesh';
import type { InteractiveObject } from '../../world/World';

export class UNILAGInterior {
  public group: THREE.Group;
  public interactiveList: InteractiveObject[] = [];
  public npcs: InteriorNPCMesh[] = [];
  public def: InteriorDefinition;

  constructor() {
    this.group = new THREE.Group();
    // Isolated world coordinates for UNILAG interior
    const origin = new THREE.Vector3(260, 0, 140);
    this.group.position.copy(origin);

    this.def = {
      id: 'interior_unilag',
      name: 'University of Lagos (UNILAG)',
      type: 'university',
      tier: 'tier3_simulated',
      districtName: 'Akoka Campus, Yaba',
      streetBuildingId: 'unilag-campus',
      streetEntrance: new THREE.Vector3(-15, 0, -32),
      streetExitRotation: 0,
      interiorOrigin: origin,
      playerSpawnOffset: new THREE.Vector3(0, 0, 9),
      exitDoorOffset: new THREE.Vector3(0, 0, 11),
      cameraOffset: new THREE.Vector3(0, 15, 18),
      ambientLightColor: 0xfef08a, // Warm academic study daylight
      ambientLightIntensity: 1.25,
      rooms: [
        {
          id: 'unilag_main_hall',
          name: 'Senate Hall & Faculty Lecture Complex',
          size: { width: 26, length: 24, height: 5.0 },
          centerOffset: new THREE.Vector3(0, 0, 0),
          floorColor: 0x94a3b8, // Polished terrazzo academic flooring
          wallColor: 0x064e3b,  // University of Lagos deep collegiate green & gold trim
        },
      ],
      stations: [
        {
          id: 'unilag_lecture_podium',
          name: 'Faculty Lecture Stage & Podium',
          category: 'University Lecture',
          description: 'Main lecture theater stage. Attend dynamic lectures on Nigerian systems, engineering, and civic tech.',
          relativePosition: new THREE.Vector3(0, 0, -6),
          actions: [
            {
              id: 'unilag_attend_lecture',
              label: '🎓 Attend Faculty Lecture (Knowledge +30)',
              description: 'Listen to Prof. Balogun deliver a high-impact lecture on cloud computing & engineering.',
              cost: 0,
              rewardKnowledge: 30,
              rewardEnergy: -10,
              dialogueResponse: '🎓 Prof. Balogun: "Excellent attentiveness! You have grasped core distributed architecture. Knowledge +30!"',
            },
          ],
        },
        {
          id: 'unilag_library_desk',
          name: 'Faculty Library Study Carrel',
          category: 'Academic Research',
          description: 'Quiet Yakubu Gowon research desks loaded with textbooks, journals, and high-speed Wi-Fi.',
          relativePosition: new THREE.Vector3(-8, 0, 0),
          actions: [
            {
              id: 'unilag_study_books',
              label: '📚 Deep Academic Research (Knowledge +40)',
              description: 'Spend time studying software engineering journals and national economic data.',
              cost: 0,
              rewardKnowledge: 40,
              rewardEnergy: -15,
              dialogueResponse: '📚 You completed two research chapters in peace. Academic Knowledge increased by +40!',
            },
          ],
        },
        {
          id: 'unilag_admin_portal',
          name: 'Faculty Course Registration Portal',
          category: 'University Admin',
          description: 'Departmental registration and student docket clearance desk.',
          relativePosition: new THREE.Vector3(8, 0, -3),
          actions: [
            {
              id: 'unilag_register_courses',
              label: '📝 Register Semester Courses (₦1,500)',
              description: 'Clear semester course units and obtain stamped examination pass.',
              cost: 1500,
              rewardKnowledge: 15,
              rewardCred: 10,
              dialogueResponse: '📝 Departmental Officer: "Course units approved and stamped! Your semester examination docket is ready."',
            },
          ],
        },
        {
          id: 'unilag_quad_gist',
          name: 'Student Quad Social Hub',
          category: 'Campus Life',
          description: 'Outdoor student lounge bench for networking, student union debates, and making friends.',
          relativePosition: new THREE.Vector3(7, 0, 5),
          actions: [
            {
              id: 'unilag_socialize',
              label: '💬 Socialize with Fellow Akokites (Social +25, Energy +20)',
              description: 'Chill at the quad, chat with course mates, and share roasted corn & plantain.',
              cost: 0,
              rewardSocial: 25,
              rewardEnergy: 20,
              dialogueResponse: '💬 Chidinma & Femi: "Great Akokite! Keep up the brilliant hustle. Energy & Social fully boosted!"',
            },
          ],
        },
      ],
      npcs: [
        {
          id: 'npc_prof_balogun',
          name: 'Prof. Adebayo Balogun',
          role: 'Lecturer',
          title: 'Dean of Computing & Sciences',
          relativePosition: new THREE.Vector3(0, 0, -5),
          rotationY: Math.PI,
          outfitColor: 0x1e3a8a, // Distinguished navy senator
          hasTie: true,
          dialogueGreeting: 'Welcome to the Faculty of Engineering & Sciences. Are you prepared for today’s lecture?',
          actions: [],
        },
        {
          id: 'npc_chidinma_student',
          name: 'Chidinma Nwosu',
          role: 'Student',
          title: 'Senior Computer Science Scholar',
          relativePosition: new THREE.Vector3(-6, 0, 2),
          rotationY: Math.PI / 4,
          outfitColor: 0x9333ea, // Vibrant purple student attire
          dialogueGreeting: 'Hey! Are you joining our hackathon squad this weekend? We are building a traffic prediction app.',
          actions: [],
        },
        {
          id: 'npc_femi_sug',
          name: 'Comrade Femi',
          role: 'Student Union Leader',
          title: 'SUG Representative',
          relativePosition: new THREE.Vector3(6, 0, 2),
          rotationY: -Math.PI / 4,
          outfitColor: 0x16a34a, // Green varsity jacket
          dialogueGreeting: 'Greatest Nigerian Students! University of First Choice and the Nation’s Pride!',
          actions: [],
        },
      ],
    };

    this.build3DInterior();
  }

  private build3DInterior(): void {
    // 1. Room shell (26m x 24m)
    const room = InteriorPrefabs.createRoom(26, 24, 5.0, 0x94a3b8, 0x064e3b);
    this.group.add(room);

    // 2. Ceiling lighting with warm collegiate tint
    this.group.add(InteriorPrefabs.createCeilingLight(new THREE.Vector3(-6, 4.8, -4), 0xfef08a));
    this.group.add(InteriorPrefabs.createCeilingLight(new THREE.Vector3(6, 4.8, -4), 0xfef08a));
    this.group.add(InteriorPrefabs.createCeilingLight(new THREE.Vector3(0, 4.8, 5), 0xfef08a));

    // 3. Exit door leading back outside to Akoka Yaba
    const exitDoor = InteriorPrefabs.createExitDoor(new THREE.Vector3(0, 0, 11), Math.PI);
    this.group.add(exitDoor);

    this.interactiveList.push({
      mesh: exitDoor,
      id: 'interior_exit_door',
      name: 'UNILAG Campus Main Gates',
      category: 'Exit',
      description: 'Exit lecture complex and return to Akoka / Yaba street.',
      interactionPoint: new THREE.Vector3(0, 0, 9.8),
    });

    // 4. Large Chalkboard / Presentation Screen on the front wall
    const boardGroup = new THREE.Group();
    boardGroup.position.set(0, 2.8, -11.6);
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(12, 3.2, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.9 }) // Classic green chalkboard
    );
    boardGroup.add(board);

    // Gold frame
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(12.3, 3.4, 0.1),
      new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8, roughness: 0.2 })
    );
    frame.position.z = -0.05;
    boardGroup.add(frame);
    this.group.add(boardGroup);

    // 5. Lecture Podium & Stage
    const stage = new THREE.Mesh(
      new THREE.BoxGeometry(10, 0.35, 5),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.6 }) // Polished mahogany stage
    );
    stage.position.set(0, 0.175, -7);
    this.group.add(stage);

    const podium = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1.25, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.4 })
    );
    podium.position.set(0, 0.8, -6.5);
    this.group.add(podium);

    // UNILAG Golden Emblem on Podium
    const crest = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.05, 16),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.8, roughness: 0.2 })
    );
    crest.rotation.x = Math.PI / 2;
    crest.position.set(0, 1.0, -6.0);
    this.group.add(crest);

    // Register lecture podium station
    this.interactiveList.push({
      mesh: podium,
      id: 'unilag_lecture_podium',
      name: 'Faculty Lecture Stage & Podium',
      category: 'University Lecture',
      description: 'Main lecture theater stage. Attend dynamic lectures on Nigerian systems, engineering, and civic tech.',
      interactionPoint: new THREE.Vector3(0, 0, -5.2),
    });

    // 6. Rows of tiered student lecture desks
    const deskMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.5 });
    const chairMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });

    for (let r = 0; r < 3; r++) {
      const zRow = -2 + r * 2.8;
      for (let side of [-4.5, 4.5]) {
        const desk = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.85, 0.9), deskMat);
        desk.position.set(side, 0.425, zRow);
        this.group.add(desk);

        // Laptop / notebook on desk
        const notebook = new THREE.Mesh(
          new THREE.BoxGeometry(0.6, 0.04, 0.4),
          new THREE.MeshStandardMaterial({ color: 0xf1f5f9 })
        );
        notebook.position.set(side, 0.87, zRow);
        this.group.add(notebook);

        // Chairs
        for (let c = -2; c <= 2; c += 2) {
          const chair = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.7), chairMat);
          chair.position.set(side + c, 0.275, zRow + 0.9);
          this.group.add(chair);
        }
      }
    }

    // 7. Library Section (Left Side)
    // Bookshelves
    for (let s = 0; s < 3; s++) {
      const shelf = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 3.8, 4.5),
        new THREE.MeshStandardMaterial({ color: 0x581c87, roughness: 0.6 }) // Deep royal violet bookshelf
      );
      shelf.position.set(-11.5, 1.9, -6 + s * 5);
      this.group.add(shelf);

      // Books inside shelf
      for (let b = 0; b < 4; b++) {
        const books = new THREE.Mesh(
          new THREE.BoxGeometry(0.65, 0.55, 3.8),
          new THREE.MeshStandardMaterial({ color: b % 2 === 0 ? 0xd97706 : 0x0284c7 })
        );
        books.position.set(-11.4, 0.6 + b * 0.9, -6 + s * 5);
        this.group.add(books);
      }
    }

    // Library study desk
    const libDesk = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.85, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x334155 })
    );
    libDesk.position.set(-8, 0.425, 0);
    this.group.add(libDesk);

    // Green banker desk lamp
    const lamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.35, 12),
      new THREE.MeshStandardMaterial({ color: 0x16a34a, metalness: 0.7, roughness: 0.2 })
    );
    lamp.position.set(-8, 1.0, 0);
    this.group.add(lamp);

    this.interactiveList.push({
      mesh: libDesk,
      id: 'unilag_library_desk',
      name: 'Faculty Library Study Carrel',
      category: 'Academic Research',
      description: 'Quiet Yakubu Gowon research desks loaded with textbooks, journals, and high-speed Wi-Fi.',
      interactionPoint: new THREE.Vector3(-8, 0, 1.2),
    });

    // 8. Admin Registration Counter (Right Side)
    const adminCounter = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 1.1, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x1e3a8a })
    );
    adminCounter.position.set(8, 0.55, -3);
    this.group.add(adminCounter);

    this.interactiveList.push({
      mesh: adminCounter,
      id: 'unilag_admin_portal',
      name: 'Faculty Course Registration Portal',
      category: 'University Admin',
      description: 'Departmental registration and student docket clearance desk.',
      interactionPoint: new THREE.Vector3(8, 0, -1.8),
    });

    // 9. Student Quad Social Lounge (Front Right)
    const quadBench = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.5, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x15803d })
    );
    quadBench.position.set(7, 0.25, 5);
    this.group.add(quadBench);

    this.interactiveList.push({
      mesh: quadBench,
      id: 'unilag_quad_gist',
      name: 'Student Quad Social Hub',
      category: 'Campus Life',
      description: 'Outdoor student lounge bench for networking, student union debates, and making friends.',
      interactionPoint: new THREE.Vector3(7, 0, 4.0),
    });

    // 10. Instantiate Character 2.0 NPCs
    this.def.npcs.forEach((npcDef) => {
      const npcMesh = new InteriorNPCMesh(npcDef);
      this.npcs.push(npcMesh);
      this.group.add(npcMesh.group);

      this.interactiveList.push({
        mesh: npcMesh.group,
        id: `interior_npc_${npcDef.id}`,
        name: npcDef.name,
        category: `Campus • ${npcDef.role}`,
        description: npcDef.dialogueGreeting,
        interactionPoint: npcDef.relativePosition.clone().add(new THREE.Vector3(0, 0, 1.2)),
      });
    });

    // Interaction points above are room-relative; the player walks in world space
    for (const obj of this.interactiveList) {
      obj.interactionPoint.add(this.group.position);
    }
  }

  public update(delta: number, animTime: number): void {
    this.npcs.forEach((npc) => npc.update(delta, animTime));
  }
}
