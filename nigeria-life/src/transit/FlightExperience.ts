import * as THREE from 'three';
import type { FlightDetails, FlightCameraView, FlightPhase } from './TransitTypes';

export class FlightExperience {
  public group: THREE.Group;
  public isActive: boolean = false;
  public currentCameraView: FlightCameraView = 'seat';
  public currentPhase: FlightPhase = 'boarding';

  // Dedicated Cameras
  public flightCamera: THREE.PerspectiveCamera;
  private cameraTarget: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

  // Flight Scene Subgroups
  private exteriorGroup: THREE.Group = new THREE.Group();
  private cabinGroup: THREE.Group = new THREE.Group();
  private tarmacGroup: THREE.Group = new THREE.Group();
  private cloudClusters: THREE.Group[] = [];
  private engineFans: THREE.Mesh[] = [];

  // Active Flight Metadata
  public currentFlight: FlightDetails | null = null;
  private phaseTimer: number = 0;
  private totalFlightTime: number = 30; // seconds for demo cruise
  private elapsedTime: number = 0;
  private animTime: number = 0;

  // In-flight entertainment canvas screen texture
  private ifeCanvas!: HTMLCanvasElement;
  private ifeContext!: CanvasRenderingContext2D;
  private ifeTexture!: THREE.CanvasTexture;

  // Callbacks
  public onFlightPhaseChanged?: (phase: FlightPhase, timeRemainingSec: number, announcement: string) => void;
  public onFlightCompleted?: (flight: FlightDetails) => void;

  constructor() {
    this.group = new THREE.Group();
    this.group.visible = false;

    this.flightCamera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      1200
    );

    this.group.add(this.exteriorGroup);
    this.group.add(this.cabinGroup);
    this.group.add(this.tarmacGroup);

    // Dedicated Bright Atmospheric Flight Lighting
    const sunLight = new THREE.DirectionalLight(0xfffbeb, 2.8);
    sunLight.position.set(60, 120, 80);
    this.group.add(sunLight);

    const ambientLight = new THREE.AmbientLight(0xe0f2fe, 1.8);
    this.group.add(ambientLight);

    this.initIFEScreen();
    this.buildExteriorAirliner();
    this.buildInteriorCabin();
    this.buildCloudsAndLandscape();
    this.buildTarmacGate();
  }

  // =========================================================================
  // 1. IN-FLIGHT ENTERTAINMENT (IFE) LIVE RADAR SCREEN CANVAS
  // =========================================================================
  private initIFEScreen(): void {
    this.ifeCanvas = document.createElement('canvas');
    this.ifeCanvas.width = 512;
    this.ifeCanvas.height = 340;
    this.ifeContext = this.ifeCanvas.getContext('2d')!;

    this.ifeTexture = new THREE.CanvasTexture(this.ifeCanvas);
    this.ifeTexture.minFilter = THREE.LinearFilter;
    this.updateIFEScreen(0.35, 35000, 47);
  }

  public updateIFEScreen(progress: number, altitudeFt: number, timeRemainingMin: number): void {
    const ctx = this.ifeContext;
    const w = 512;
    const h = 340;

    // Dark sleek aviation blue background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    // Top Header Status Bar
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, w, 52);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 24px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${altitudeFt.toLocaleString()} ft • ${Math.round(timeRemainingMin)} min`, 24, 35);

    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 22px "Segoe UI", sans-serif';
    ctx.textAlign = 'right';
    const destCode = this.currentFlight ? this.currentFlight.destinationCode : 'PHC';
    ctx.fillText(`EN ROUTE TO ${destCode}`, w - 24, 35);

    // Radar Map Circle Globe Grid
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(w / 2, 195, 120, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(w / 2, 195, 120, 45, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(w / 2 - 120, 195);
    ctx.lineTo(w / 2 + 120, 195);
    ctx.stroke();

    // Flight Path Arc
    const startX = 140;
    const startY = 240;
    const endX = 370;
    const endY = 150;

    // Dashed trajectory arc
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(w / 2, 110, endX, endY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Solid progress path
    const curX = THREE.MathUtils.lerp(startX, endX, progress);
    const curY = THREE.MathUtils.lerp(startY, endY, progress) - Math.sin(progress * Math.PI) * 45;

    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(curX, curY);
    ctx.stroke();

    // Origin airport badge
    const originCode = this.currentFlight ? this.currentFlight.originCode : 'LOS';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(originCode, startX - 25, startY + 10);

    // Destination airport badge
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(destCode, endX + 25, endY - 5);

    // Live Yellow Airplane Icon on path
    ctx.fillStyle = '#facc15';
    ctx.font = '28px sans-serif';
    ctx.fillText('✈️', curX, curY + 8);

    this.ifeTexture.needsUpdate = true;
  }

  // =========================================================================
  // 2. 3D EXTERIOR COMMERCIAL PASSENGER AIRLINER
  // =========================================================================
  private buildExteriorAirliner(): void {
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3, metalness: 0.2 });
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.3, metalness: 0.2 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.3, metalness: 0.4 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1, metalness: 0.9 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.4, metalness: 0.6 });

    // A. Main Fuselage Tube (Length: 38m, Radius: 2.6m)
    const fuseGeo = new THREE.CylinderGeometry(2.6, 2.6, 32, 24);
    const fuselage = new THREE.Mesh(fuseGeo, whiteMat);
    fuselage.rotation.x = Math.PI / 2;
    fuselage.castShadow = true;
    this.exteriorGroup.add(fuselage);

    // Aerodynamic Nose Cone
    const noseGeo = new THREE.ConeGeometry(2.6, 7.5, 24);
    const nose = new THREE.Mesh(noseGeo, whiteMat);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = 19.75;
    this.exteriorGroup.add(nose);

    // Cockpit Windows
    const cockpitGeo = new THREE.BoxGeometry(2.8, 0.9, 2.2);
    const cockpit = new THREE.Mesh(cockpitGeo, glassMat);
    cockpit.position.set(0, 1.4, 18.5);
    cockpit.rotation.x = -0.3;
    this.exteriorGroup.add(cockpit);

    // Green & Gold Airline Stripe along fuselage
    const stripeGeo = new THREE.CylinderGeometry(2.62, 2.62, 28, 24, 1, true, 0, Math.PI * 2);
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0x15803d });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.rotation.x = Math.PI / 2;
    stripe.position.set(0, 0.2, 0);
    this.exteriorGroup.add(stripe);

    // Tapered Tail Cone
    const tailConeGeo = new THREE.CylinderGeometry(2.6, 0.8, 8.5, 24);
    const tailCone = new THREE.Mesh(tailConeGeo, whiteMat);
    tailCone.rotation.x = Math.PI / 2;
    tailCone.position.z = -20.25;
    this.exteriorGroup.add(tailCone);

    // B. Iconic Swept Wings (Wingspan: 36m)
    const wingGeo = new THREE.BoxGeometry(36, 0.45, 6.5);
    const wings = new THREE.Mesh(wingGeo, whiteMat);
    wings.position.set(0, -0.6, -2);
    wings.castShadow = true;
    this.exteriorGroup.add(wings);

    // Winglet tips (Green)
    for (const wx of [-18, 18]) {
      const winglet = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.6, 2.0), greenMat);
      winglet.position.set(wx, 0.6, -2);
      this.exteriorGroup.add(winglet);
    }

    // C. Vertical Stabilizer Tail Fin with Nigerian Green/Gold Livery
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.lineTo(0, 8.5);
    finShape.lineTo(3.8, 8.0);
    finShape.lineTo(6.5, 0);
    finShape.closePath();

    const finExtrude = new THREE.ExtrudeGeometry(finShape, { depth: 0.4, bevelEnabled: false });
    const fin = new THREE.Mesh(finExtrude, greenMat);
    fin.rotation.y = Math.PI / 2;
    fin.position.set(-0.2, 2.4, -18.5);
    this.exteriorGroup.add(fin);

    // Gold "NL" Circular Logo on Tail
    const logoMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.45, 18), goldMat);
    logoMesh.rotation.z = Math.PI / 2;
    logoMesh.position.set(0, 6.5, -20.5);
    this.exteriorGroup.add(logoMesh);

    // D. Horizontal Stabilizers
    const hTailGeo = new THREE.BoxGeometry(13, 0.35, 3.2);
    const hTail = new THREE.Mesh(hTailGeo, whiteMat);
    hTail.position.set(0, 2.8, -23.5);
    this.exteriorGroup.add(hTail);

    // E. Jet Turbofan Engines under Wings
    for (const ex of [-8.5, 8.5]) {
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 2.8), metalMat);
      pylon.position.set(ex, -1.0, -1.5);
      this.exteriorGroup.add(pylon);

      const pod = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 4.6, 18), whiteMat);
      pod.rotation.x = Math.PI / 2;
      pod.position.set(ex, -1.8, -1.5);
      this.exteriorGroup.add(pod);

      // Spinning turbofan blades disk
      const fanMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 });
      const fan = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.2, 12), fanMat);
      fan.rotation.x = Math.PI / 2;
      fan.position.set(ex, -1.8, 0.8);
      this.exteriorGroup.add(fan);
      this.engineFans.push(fan);
    }
  }

  // =========================================================================
  // 3. 3D INTERIOR CABIN WITH PASSENGERS, SEATS & IFE SCREEN
  // =========================================================================
  private buildInteriorCabin(): void {
    const seatBlue = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.6 });
    const seatWhite = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
    const carpetMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.4 });
    const overheadMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 });

    // Cabin Floor Carpet
    const floor = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.2, 28), carpetMat);
    floor.position.set(0, 0.1, 0);
    this.cabinGroup.add(floor);

    // Cabin Ceiling & Overhead Bins
    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.3, 28), overheadMat);
    ceiling.position.set(0, 3.4, 0);
    this.cabinGroup.add(ceiling);

    // Warm Cabin Soft Lighting Strip
    const cabinLight = new THREE.PointLight(0xfef08a, 1.8, 18);
    cabinLight.position.set(0, 3.0, 0);
    this.cabinGroup.add(cabinLight);

    // Left and Right Wall Enclosures
    const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.2, 28), wallMat);
    wallL.position.set(-2.6, 1.7, 0);
    this.cabinGroup.add(wallL);

    const wallR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.2, 28), wallMat);
    wallR.position.set(2.6, 1.7, 0);
    this.cabinGroup.add(wallR);

    // Windows on Walls
    const windowMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    for (let z = -12; z <= 12; z += 2.2) {
      const winL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.9, 0.6), windowMat);
      winL.position.set(-2.55, 1.8, z);
      this.cabinGroup.add(winL);

      const winR = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.9, 0.6), windowMat);
      winR.position.set(2.55, 1.8, z);
      this.cabinGroup.add(winR);
    }

    // Passenger Rows (Left & Right 2-by-2 seating)
    const ankaraFabrics = [0xd97706, 0x059669, 0xdc2626, 0x7c3aed, 0x2563eb, 0xca8a04];

    for (let z = -12; z <= 12; z += 2.2) {
      // Row Left (2 seats) and Row Right (2 seats)
      for (const side of [-1.4, 1.4]) {
        // Seat Cushion
        const cushion = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 0.8), seatBlue);
        cushion.position.set(side, 0.6, z);
        this.cabinGroup.add(cushion);

        // Seat Backrest
        const backrest = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.3, 0.25), seatWhite);
        backrest.position.set(side, 1.3, z - 0.35);
        this.cabinGroup.add(backrest);

        // Headrest Cover
        const headrest = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 0.28), seatBlue);
        headrest.position.set(side, 1.85, z - 0.35);
        this.cabinGroup.add(headrest);

        // 3D Passenger (Skip front row where player sits in 'seat' view)
        if (z !== 0 || side !== -1.4) {
          const skinColor = 0x6b4226;
          const fabricColor = ankaraFabrics[Math.abs(Math.round(z * 3 + side)) % ankaraFabrics.length];

          const torsoMat = new THREE.MeshStandardMaterial({ color: fabricColor, roughness: 0.7 });
          const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.8 });

          // Seated Passenger Body
          const body = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.8, 0.4), torsoMat);
          body.position.set(side + (side < 0 ? -0.3 : 0.3), 1.1, z);
          this.cabinGroup.add(body);

          const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), skinMat);
          head.position.set(side + (side < 0 ? -0.3 : 0.3), 1.7, z);
          this.cabinGroup.add(head);
        }
      }
    }

    // =======================================================================
    // "MY SEAT" SPECIAL ROW (Row 14 facing In-Flight Entertainment Screen)
    // =======================================================================
    const ifeScreenMat = new THREE.MeshBasicMaterial({ map: this.ifeTexture });
    const screenMesh = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.55, 0.05), ifeScreenMat);
    screenMesh.position.set(-1.1, 1.45, -0.22);
    this.cabinGroup.add(screenMesh);

    // Tray Table below screen
    const trayMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.4 });
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.45), trayMat);
    tray.position.set(-1.1, 0.95, 0.0);
    this.cabinGroup.add(tray);

    // Refreshment cup on tray
    const cupMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 }); // Zobo Red cup
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.18, 10), cupMat);
    cup.position.set(-0.85, 1.05, 0.05);
    this.cabinGroup.add(cup);

    // Small chops snack box on tray
    const boxMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.6 });
    const snackBox = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.22), boxMat);
    snackBox.position.set(-1.25, 1.0, 0.02);
    this.cabinGroup.add(snackBox);

    // Air Hostess & Catering Trolley in aisle
    const trolleyMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7 });
    const trolley = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 1.2), trolleyMat);
    trolley.position.set(0, 0.6, -7.5);
    this.cabinGroup.add(trolley);

    const hostessMat = new THREE.MeshStandardMaterial({ color: 0x15803d }); // Green uniform
    const hostessBody = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.2, 0.35), hostessMat);
    hostessBody.position.set(0, 1.7, -8.3);
    this.cabinGroup.add(hostessBody);

    const hostessHead = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), new THREE.MeshStandardMaterial({ color: 0x6b4226 }));
    hostessHead.position.set(0, 2.45, -8.3);
    this.cabinGroup.add(hostessHead);
  }

  // =========================================================================
  // 4. VOLUMETRIC DRIFTING CLOUDS & AERIAL NIGERIAN LANDSCAPE
  // =========================================================================
  private buildCloudsAndLandscape(): void {
    // Aerial Ground Landscape Far Below (Z: -300 to 300, Y: -120)
    const landscapeGeo = new THREE.PlaneGeometry(800, 800, 12, 12);
    const landscapeMat = new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.9 });
    const landscape = new THREE.Mesh(landscapeGeo, landscapeMat);
    landscape.rotation.x = -Math.PI / 2;
    landscape.position.y = -130;
    this.exteriorGroup.add(landscape);

    // Aerial River Ribbon below
    const riverGeo = new THREE.PlaneGeometry(35, 750);
    const riverMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
    const river = new THREE.Mesh(riverGeo, riverMat);
    river.rotation.x = -Math.PI / 2;
    river.rotation.z = 0.35;
    river.position.set(-60, -129, 0);
    this.exteriorGroup.add(river);

    // Procedural Drifting Fluffy Clouds
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95,
      transparent: true,
      opacity: 0.88,
    });

    for (let i = 0; i < 28; i++) {
      const cluster = new THREE.Group();
      for (let j = 0; j < 5; j++) {
        const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(5 + Math.random() * 6, 1), cloudMat);
        puff.position.set(
          (Math.random() - 0.5) * 14,
          (Math.random() - 0.5) * 4,
          (Math.random() - 0.5) * 14
        );
        cluster.add(puff);
      }
      cluster.position.set(
        (Math.random() - 0.5) * 260,
        -10 + (Math.random() - 0.5) * 20,
        -200 + (Math.random() * 400)
      );
      this.exteriorGroup.add(cluster);
      this.cloudClusters.push(cluster);
    }
  }

  // =========================================================================
  // 5. TARMAC GATE & JET BRIDGE (Boarding Phase)
  // =========================================================================
  private buildTarmacGate(): void {
    const tarmacMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
    const yellowMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

    // Concrete Tarmac Apron
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(280, 240), tarmacMat);
    apron.rotation.x = -Math.PI / 2;
    apron.position.y = -2.7;
    this.tarmacGroup.add(apron);

    // Taxiway Line
    const taxiLine = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 200), yellowMat);
    taxiLine.rotation.x = -Math.PI / 2;
    taxiLine.position.set(0, -2.68, 0);
    this.tarmacGroup.add(taxiLine);

    // Jet Bridge Tube connecting to aircraft door
    const bridgeTube = new THREE.Mesh(
      new THREE.BoxGeometry(16, 2.8, 3.2),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4 })
    );
    bridgeTube.position.set(-11, 0.4, 10);
    this.tarmacGroup.add(bridgeTube);

    // Airport Billboards along perimeter
    const billboardMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
    const bb = new THREE.Mesh(new THREE.BoxGeometry(22, 6, 0.4), billboardMat);
    bb.position.set(-45, 1.5, 20);
    bb.rotation.y = 0.35;
    this.tarmacGroup.add(bb);
  }

  // =========================================================================
  // FLIGHT CONTROLS & LIFECYCLE
  // =========================================================================
  public startFlight(flight: FlightDetails): void {
    this.currentFlight = flight;
    this.isActive = true;
    this.group.visible = true;
    this.elapsedTime = 0;
    this.phaseTimer = 0;
    this.totalFlightTime = flight.durationSeconds || 32;

    this.setPhase('boarding');
    this.setCameraView('seat');
  }

  public setPhase(phase: FlightPhase): void {
    this.currentPhase = phase;
    this.phaseTimer = 0;

    if (phase === 'boarding') {
      this.tarmacGroup.visible = true;
      this.exteriorGroup.position.set(0, 0, 0);
      this.cabinGroup.position.set(0, 0, 0);
      this.onFlightPhaseChanged?.(
        'boarding',
        16,
        'Boarding at the gate: find your seat, bags in the overhead bins.'
      );
    } else if (phase === 'cruise') {
      this.tarmacGroup.visible = false;
      this.onFlightPhaseChanged?.(
        'cruise',
        46,
        'Through the clouds. The seatbelt sign is off. Refreshments served shortly.'
      );
    } else if (phase === 'landing') {
      this.tarmacGroup.visible = true;
      this.onFlightPhaseChanged?.(
        'landing',
        4,
        `Touching down at ${this.currentFlight?.destinationName || 'Destination Airport'}. Welcome!`
      );
    }
  }

  public setCameraView(view: FlightCameraView): void {
    this.currentCameraView = view;
    this.updateCameraTransform();
  }

  public skipFlight(): void {
    this.completeFlight();
  }

  private completeFlight(): void {
    this.isActive = false;
    this.group.visible = false;
    if (this.currentFlight) {
      this.onFlightCompleted?.(this.currentFlight);
    }
  }

  private updateCameraTransform(): void {
    if (this.currentCameraView === 'outside') {
      // Exterior cinematic chase tracking
      this.cabinGroup.visible = false;
      this.exteriorGroup.visible = true;
      this.flightCamera.position.set(24, 12, 36);
      this.cameraTarget.set(0, 0, 0);
      this.flightCamera.lookAt(this.cameraTarget);
    } else if (this.currentCameraView === 'cabin') {
      // Wide interior aisle view looking down seats
      this.cabinGroup.visible = true;
      this.exteriorGroup.visible = false;
      this.flightCamera.position.set(0, 2.3, -7.0);
      this.cameraTarget.set(0, 1.8, 6.0);
      this.flightCamera.lookAt(this.cameraTarget);
    } else {
      // First-person seatback view in row 14 facing IFE screen
      this.cabinGroup.visible = true;
      this.exteriorGroup.visible = false;
      this.flightCamera.position.set(-1.1, 1.55, 0.75);
      this.cameraTarget.set(-1.1, 1.45, -0.22);
      this.flightCamera.lookAt(this.cameraTarget);
    }
  }

  // =========================================================================
  // UPDATE LOOP (Cloud drifting, IFE screen refresh, engine fan rotation)
  // =========================================================================
  public update(delta: number): void {
    if (!this.isActive) return;

    this.animTime += delta;
    this.elapsedTime += delta;
    this.phaseTimer += delta;

    // Spin Jet Turbofans
    for (const fan of this.engineFans) {
      fan.rotation.y += delta * 45;
    }

    // Drift Clouds past plane at cruising airspeed
    if (this.currentPhase === 'cruise') {
      for (const cloud of this.cloudClusters) {
        cloud.position.z += delta * 45;
        if (cloud.position.z > 200) {
          cloud.position.z = -200;
          cloud.position.x = (Math.random() - 0.5) * 260;
        }
      }
    }

    // Automatic Flight Phase Progression
    if (this.currentPhase === 'boarding' && this.phaseTimer > 8) {
      this.setPhase('cruise');
    } else if (this.currentPhase === 'cruise' && this.elapsedTime > this.totalFlightTime - 6) {
      this.setPhase('landing');
    } else if (this.currentPhase === 'landing' && this.phaseTimer > 5) {
      this.completeFlight();
      return;
    }

    // Refresh IFE Radar Screen Texture
    const progress = Math.min(1.0, this.elapsedTime / this.totalFlightTime);
    const altitude = this.currentPhase === 'boarding' ? 0 : this.currentPhase === 'landing' ? 2500 : 35000;
    const timeRemainingMin = Math.max(1, Math.round((1 - progress) * 55));
    this.updateIFEScreen(progress, altitude, timeRemainingMin);
  }

  public handleResize(): void {
    this.flightCamera.aspect = window.innerWidth / window.innerHeight;
    this.flightCamera.updateProjectionMatrix();
  }
}
