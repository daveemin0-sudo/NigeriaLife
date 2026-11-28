import * as THREE from 'three';

/**
 * What is on a Nigerian supermarket's shelves: packs, tins, bottles, sachets and sacks, drawn as
 * the faces of whole rows of goods on one shared picture (an atlas of designs). A row of the same
 * product on a shelf is one block with that design across its front, so a full aisle of goods is a
 * few hundred blocks merged into one mesh: one draw for the whole supermarket's stock.
 */

/** How a design's goods stand: a row of packs, of bottles or tins with gaps between, or sacks */
type Shape = 'pack' | 'bottle' | 'tin' | 'sack' | 'sachet' | 'loaf' | 'jar';

interface Design {
  shape: Shape;
  /** The pack's colour, its band or label, and the writing on it */
  colours: [string, string, string];
  word: string;
  /** How many fit across one block (a metre of shelf) */
  across: number;
}

/** Brands made up for the game: the look of what is on the shelves in Lagos, not anyone's products */
const DESIGNS: Record<string, Design> = {
  rice: { shape: 'sack', colours: ['#f4efe2', '#b91c1c', '#14532d'], word: 'EKO GOLD RICE', across: 3 },
  riceSmall: { shape: 'pack', colours: ['#fefce8', '#16a34a', '#14532d'], word: 'RICE 5kg', across: 4 },
  garri: { shape: 'sack', colours: ['#fef9c3', '#ca8a04', '#713f12'], word: 'IJEBU GARRI', across: 3 },
  semolina: { shape: 'pack', colours: ['#fde68a', '#1d4ed8', '#1e3a8a'], word: 'SEMOLINA', across: 4 },
  flour: { shape: 'sack', colours: ['#ffffff', '#2563eb', '#1e3a8a'], word: 'GOLDEN FLOUR', across: 3 },
  beans: { shape: 'sack', colours: ['#e7d7c1', '#7c2d12', '#431407'], word: 'OLOYIN BEANS', across: 3 },
  noodles: { shape: 'sachet', colours: ['#facc15', '#dc2626', '#7f1d1d'], word: 'NAIJA STAR', across: 7 },
  noodlesBlue: { shape: 'sachet', colours: ['#2563eb', '#facc15', '#ffffff'], word: 'OGA NOODLES', across: 7 },
  spaghetti: { shape: 'pack', colours: ['#1d4ed8', '#fde047', '#ffffff'], word: 'SPAGHETTI', across: 6 },
  cornflakes: { shape: 'pack', colours: ['#f97316', '#fef08a', '#7c2d12'], word: 'SUNRISE', across: 4 },
  oats: { shape: 'pack', colours: ['#fefce8', '#a16207', '#422006'], word: 'OATS', across: 4 },
  milkTin: { shape: 'tin', colours: ['#1e40af', '#f8fafc', '#1e3a8a'], word: 'LAGOS DAIRY', across: 6 },
  milkPowder: { shape: 'pack', colours: ['#0ea5e9', '#ffffff', '#0c4a6e'], word: 'MILK', across: 5 },
  cocoa: { shape: 'jar', colours: ['#78350f', '#fbbf24', '#ffffff'], word: 'COCOA', across: 5 },
  tea: { shape: 'pack', colours: ['#dc2626', '#facc15', '#ffffff'], word: 'OGA TEA', across: 6 },
  tomato: { shape: 'tin', colours: ['#dc2626', '#16a34a', '#ffffff'], word: 'TOMATO', across: 8 },
  sardine: { shape: 'tin', colours: ['#1e3a8a', '#e5e7eb', '#ffffff'], word: 'SARDINE', across: 8 },
  seasoning: { shape: 'pack', colours: ['#facc15', '#dc2626', '#7f1d1d'], word: 'CUBES', across: 8 },
  palmOil: { shape: 'bottle', colours: ['#c2410c', '#fef3c7', '#7c2d12'], word: 'PALM OIL', across: 5 },
  vegOil: { shape: 'bottle', colours: ['#fde047', '#16a34a', '#14532d'], word: 'VEG OIL', across: 5 },
  water: { shape: 'bottle', colours: ['#bae6fd', '#0284c7', '#ffffff'], word: 'EKO WATER', across: 7 },
  cola: { shape: 'bottle', colours: ['#3f1d0c', '#dc2626', '#ffffff'], word: 'ZEST COLA', across: 7 },
  orange: { shape: 'bottle', colours: ['#fb923c', '#16a34a', '#ffffff'], word: 'FANTASIA', across: 7 },
  lemon: { shape: 'bottle', colours: ['#bef264', '#15803d', '#14532d'], word: 'LEMON UP', across: 7 },
  malt: { shape: 'tin', colours: ['#1c1917', '#fbbf24', '#fbbf24'], word: 'KOLA MALT', across: 8 },
  juice: { shape: 'pack', colours: ['#f59e0b', '#16a34a', '#ffffff'], word: 'JUICE 1L', across: 6 },
  yoghurt: { shape: 'bottle', colours: ['#fdf2f8', '#db2777', '#831843'], word: 'YOGHURT', across: 7 },
  biscuits: { shape: 'pack', colours: ['#7c3aed', '#facc15', '#ffffff'], word: 'CABIN', across: 6 },
  chinchin: { shape: 'sachet', colours: ['#fbbf24', '#9a3412', '#431407'], word: 'CHIN CHIN', across: 6 },
  plantain: { shape: 'sachet', colours: ['#16a34a', '#fde047', '#ffffff'], word: 'PLANTAIN CHIPS', across: 6 },
  sweets: { shape: 'jar', colours: ['#f472b6', '#ffffff', '#831843'], word: 'SWEETS', across: 6 },
  detergent: { shape: 'pack', colours: ['#2563eb', '#f97316', '#ffffff'], word: 'SPARKLE', across: 5 },
  detergentRed: { shape: 'sack', colours: ['#dc2626', '#facc15', '#ffffff'], word: 'BRIGHT WASH', across: 3 },
  soap: { shape: 'pack', colours: ['#f9a8d4', '#ffffff', '#9d174d'], word: 'SOAP', across: 9 },
  soapGreen: { shape: 'pack', colours: ['#86efac', '#ffffff', '#14532d'], word: 'NEEM', across: 9 },
  toothpaste: { shape: 'pack', colours: ['#ffffff', '#dc2626', '#1d4ed8'], word: 'SMILE', across: 8 },
  tissue: { shape: 'sack', colours: ['#f8fafc', '#38bdf8', '#0369a1'], word: 'SOFT ROLLS', across: 3 },
  bleach: { shape: 'bottle', colours: ['#f8fafc', '#2563eb', '#1e3a8a'], word: 'BLEACH', across: 6 },
  insecticide: { shape: 'bottle', colours: ['#facc15', '#16a34a', '#14532d'], word: 'KILL IT', across: 6 },
  diapers: { shape: 'sack', colours: ['#e0f2fe', '#f472b6', '#1e3a8a'], word: 'BABY DRY', across: 3 },
  hairCream: { shape: 'jar', colours: ['#fde68a', '#7c3aed', '#3b0764'], word: 'HAIR', across: 7 },
  lotion: { shape: 'bottle', colours: ['#fff7ed', '#ea580c', '#7c2d12'], word: 'COCOA BUTTER', across: 6 },
  bread: { shape: 'loaf', colours: ['#d97706', '#fde68a', '#78350f'], word: 'AGEGE', across: 5 },
  breadSliced: { shape: 'loaf', colours: ['#b45309', '#f8fafc', '#dc2626'], word: 'SLICED', across: 5 },
  wine: { shape: 'bottle', colours: ['#4c0519', '#fef3c7', '#fef3c7'], word: 'WINE', across: 6 },
  beer: { shape: 'bottle', colours: ['#14532d', '#facc15', '#ffffff'], word: 'LAGER', across: 7 },
  stout: { shape: 'bottle', colours: ['#0c0a09', '#fbbf24', '#fbbf24'], word: 'STOUT', across: 7 },
  energy: { shape: 'tin', colours: ['#111827', '#ef4444', '#facc15'], word: 'POWER', across: 8 },
  pepper: { shape: 'jar', colours: ['#991b1b', '#fde047', '#ffffff'], word: 'PEPPER', across: 7 },
  honey: { shape: 'jar', colours: ['#d97706', '#fef3c7', '#78350f'], word: 'HONEY', across: 6 },
  groundnut: { shape: 'jar', colours: ['#c2410c', '#fef3c7', '#7c2d12'], word: 'PEANUT', across: 6 },
  custard: { shape: 'tin', colours: ['#fde047', '#1d4ed8', '#1e3a8a'], word: 'CUSTARD', across: 6 },
};

export type GoodsName = keyof typeof DESIGNS;

const COLS = 4;
const CELL_W = 256;
const CELL_H = 78;
/** The strip at the right of each cell, one flat colour: the sides and tops of the goods */
const EDGE = 8;
const SIZE = 1024;
const NAMES = Object.keys(DESIGNS) as GoodsName[];

let atlas: { texture: THREE.CanvasTexture; cell: Map<GoodsName, number> } | null = null;

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** One design drawn into its cell: `across` of the item side by side, standing on the cell's floor */
function paint(g: CanvasRenderingContext2D, x0: number, y0: number, d: Design): void {
  const [body, band, ink] = d.colours;
  const width = CELL_W - EDGE;
  const each = width / d.across;
  g.save();
  g.beginPath();
  g.rect(x0, y0, width, CELL_H);
  g.clip();
  for (let i = 0; i < d.across; i++) {
    const x = x0 + i * each;
    const font = (size: number) => `800 ${size}px "Arial Narrow", Arial, sans-serif`;
    const label = (y: number, h: number, w: number, cx: number) => {
      g.fillStyle = ink;
      const size = Math.max(6, Math.min(h * 0.8, (w / Math.max(4, d.word.length)) * 1.7));
      g.font = font(size);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(d.word, cx, y + h / 2, w * 0.92);
    };
    switch (d.shape) {
      case 'pack': {
        // A carton standing up: its face, a band across with the name, a lighter edge on one side
        const w = each - 3;
        const top = y0 + 6;
        g.fillStyle = body;
        g.fillRect(x + 1.5, top, w, CELL_H - 6);
        g.fillStyle = band;
        g.fillRect(x + 1.5, top + (CELL_H - 6) * 0.38, w, (CELL_H - 6) * 0.3);
        label(top + (CELL_H - 6) * 0.38, (CELL_H - 6) * 0.3, w, x + 1.5 + w / 2);
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.fillRect(x + 1.5, top, w * 0.12, CELL_H - 6);
        g.fillStyle = 'rgba(0,0,0,0.18)';
        g.fillRect(x + 1.5 + w * 0.9, top, w * 0.1, CELL_H - 6);
        break;
      }
      case 'sachet': {
        // Pillow packs, a little shorter, crimped at the top, a picture window
        const w = each - 2;
        const top = y0 + CELL_H * 0.32;
        g.fillStyle = body;
        roundRect(g, x + 1, top, w, CELL_H - top + y0, 4);
        g.fill();
        g.fillStyle = band;
        g.beginPath();
        g.ellipse(x + 1 + w / 2, top + (CELL_H - top + y0) * 0.6, w * 0.34, (CELL_H - top + y0) * 0.22, 0, 0, Math.PI * 2);
        g.fill();
        label(top + 3, (CELL_H - top + y0) * 0.3, w, x + 1 + w / 2);
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(x + 1, top, w, 3);
        break;
      }
      case 'sack': {
        // A woven sack slumped on the shelf: rounded shoulders, a printed panel
        const w = each - 4;
        const top = y0 + 4;
        g.fillStyle = body;
        roundRect(g, x + 2, top, w, CELL_H - 4, w * 0.18);
        g.fill();
        g.fillStyle = band;
        g.fillRect(x + 2 + w * 0.1, top + CELL_H * 0.28, w * 0.8, CELL_H * 0.36);
        label(top + CELL_H * 0.28, CELL_H * 0.36, w * 0.8, x + 2 + w / 2);
        g.strokeStyle = 'rgba(0,0,0,0.12)';
        for (let s = 0; s < 6; s++) {
          g.beginPath();
          g.moveTo(x + 2, top + s * 15);
          g.lineTo(x + 2 + w, top + s * 15 + 4);
          g.stroke();
        }
        break;
      }
      case 'bottle': {
        // Bottles with shoulders, a neck and a cap; the shelf shows between them
        const w = each * 0.72;
        const cx = x + each / 2;
        const top = y0 + 4;
        const shoulder = top + CELL_H * 0.3;
        g.fillStyle = body;
        g.fillRect(cx - w * 0.16, top + 6, w * 0.32, CELL_H * 0.3);
        roundRect(g, cx - w / 2, shoulder, w, CELL_H - (shoulder - y0), w * 0.2);
        g.fill();
        g.fillStyle = band;
        g.fillRect(cx - w / 2, shoulder + CELL_H * 0.18, w, CELL_H * 0.28);
        label(shoulder + CELL_H * 0.18, CELL_H * 0.28, w, cx);
        g.fillStyle = ink;
        g.fillRect(cx - w * 0.18, top, w * 0.36, 7);
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.fillRect(cx - w * 0.36, shoulder + 4, w * 0.1, CELL_H * 0.5);
        break;
      }
      case 'tin': {
        // Tins stacked two high, a label round each
        const w = each - 3;
        const h = (CELL_H - 4) / 2;
        for (let r = 0; r < 2; r++) {
          const top = y0 + 4 + r * h;
          g.fillStyle = '#d4d4d8';
          g.fillRect(x + 1.5, top, w, h - 1);
          g.fillStyle = body;
          g.fillRect(x + 1.5, top + 3, w, h - 7);
          g.fillStyle = band;
          g.fillRect(x + 1.5, top + h * 0.35, w, h * 0.3);
          label(top + h * 0.35, h * 0.3, w, x + 1.5 + w / 2);
        }
        break;
      }
      case 'jar': {
        // Jars and tubs: a wide lid, a round body
        const w = each - 4;
        const top = y0 + CELL_H * 0.25;
        g.fillStyle = ink;
        g.fillRect(x + 2 + w * 0.08, top, w * 0.84, 8);
        g.fillStyle = body;
        roundRect(g, x + 2, top + 8, w, CELL_H - (top - y0) - 8, 6);
        g.fill();
        g.fillStyle = band;
        g.fillRect(x + 2, top + 8 + (CELL_H - (top - y0)) * 0.25, w, (CELL_H - (top - y0)) * 0.35);
        label(top + 8 + (CELL_H - (top - y0)) * 0.25, (CELL_H - (top - y0)) * 0.35, w, x + 2 + w / 2);
        break;
      }
      case 'loaf': {
        // Bread in its nylon: a domed loaf, the printed bag over it
        const w = each - 3;
        const top = y0 + CELL_H * 0.3;
        g.fillStyle = body;
        roundRect(g, x + 1.5, top, w, CELL_H - (top - y0), w * 0.35);
        g.fill();
        g.fillStyle = band;
        g.fillRect(x + 1.5, top + (CELL_H - (top - y0)) * 0.45, w, (CELL_H - (top - y0)) * 0.3);
        label(top + (CELL_H - (top - y0)) * 0.45, (CELL_H - (top - y0)) * 0.3, w, x + 1.5 + w / 2);
        break;
      }
    }
  }
  g.restore();
  // The edge strip: the goods' own colour, for their sides and tops
  g.fillStyle = body;
  g.fillRect(x0 + width, y0, EDGE, CELL_H);
}

function goodsAtlas(): { texture: THREE.CanvasTexture; cell: Map<GoodsName, number> } {
  if (atlas) return atlas;
  const c = document.createElement('canvas');
  c.width = SIZE;
  c.height = SIZE;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, SIZE, SIZE);
  const cell = new Map<GoodsName, number>();
  NAMES.forEach((name, i) => {
    paint(g, (i % COLS) * CELL_W, Math.floor(i / COLS) * CELL_H, DESIGNS[name]);
    cell.set(name, i);
  });
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.generateMipmaps = true;
  atlas = { texture, cell };
  return atlas;
}

/**
 * Blocks of goods gathered for one mesh. Each block is a row of one product on a shelf: its front
 * shows the design (packs side by side, bottles with the shelf between them), its sides and top
 * the product's colour.
 */
export class GoodsMesh {
  private readonly pos: number[] = [];
  private readonly nor: number[] = [];
  private readonly uv: number[] = [];
  private readonly m = new THREE.Matrix4();
  private readonly v = new THREE.Vector3();
  private readonly n = new THREE.Vector3();
  private readonly normalMatrix = new THREE.Matrix3();

  /**
   * A row of `name` `w` wide, `h` high and `d` deep, the middle of its base at (x, y, z), its front
   * turned to face `yaw` (0 faces +z).
   */
  public add(name: GoodsName, w: number, h: number, d: number, x: number, y: number, z: number, yaw = 0): this {
    const { cell } = goodsAtlas();
    const i = cell.get(name) ?? 0;
    const u0 = ((i % COLS) * CELL_W) / SIZE;
    const u1 = u0 + (CELL_W - EDGE) / SIZE;
    const v1 = 1 - (Math.floor(i / COLS) * CELL_H) / SIZE;
    const v0 = v1 - CELL_H / SIZE;
    const ue = u0 + (CELL_W - EDGE / 2) / SIZE;
    const ve = (v0 + v1) / 2;
    const shape = DESIGNS[name].shape;
    this.m.makeRotationY(yaw).setPosition(x, y, z);
    this.normalMatrix.getNormalMatrix(this.m);
    const hw = w / 2;
    const hd = d / 2;
    // Goods with gaps between them (bottles, jars) are two cut-out faces, one behind the other: no
    // solid block over the gaps. Packs and sacks are solid blocks with their tops showing.
    if (shape === 'bottle' || shape === 'jar') {
      this.quad([-hw, 0, hd], [hw, 0, hd], [hw, h, hd], [-hw, h, hd], [0, 0, 1], [u0, v0, u1, v1]);
      this.quad([-hw + 0.03, 0, -hd * 0.2], [hw + 0.03, 0, -hd * 0.2], [hw + 0.03, h, -hd * 0.2], [-hw + 0.03, h, -hd * 0.2], [0, 0, 1], [u0, v0, u1, v1]);
      return this;
    }
    const e: [number, number, number, number] = [ue, ve, ue, ve];
    // The top of a pack is below the top of its picture (the picture has a little air above it)
    const top = shape === 'sachet' || shape === 'loaf' ? h * 0.7 : shape === 'pack' || shape === 'tin' ? h * 0.95 : h * 0.9;
    this.quad([-hw, 0, hd], [hw, 0, hd], [hw, h, hd], [-hw, h, hd], [0, 0, 1], [u0, v0, u1, v1]);
    this.quad([-hw, top, hd], [hw, top, hd], [hw, top, -hd], [-hw, top, -hd], [0, 1, 0], e);
    this.quad([hw, 0, hd], [hw, 0, -hd], [hw, top, -hd], [hw, top, hd], [1, 0, 0], e);
    this.quad([-hw, 0, -hd], [-hw, 0, hd], [-hw, top, hd], [-hw, top, -hd], [-1, 0, 0], e);
    return this;
  }

  private quad(a: number[], b: number[], c: number[], d: number[], normal: number[], [u0, v0, u1, v1]: [number, number, number, number]): void {
    const corners = [a, b, c, a, c, d];
    const uvs = [[u0, v0], [u1, v0], [u1, v1], [u0, v0], [u1, v1], [u0, v1]];
    this.n.set(normal[0], normal[1], normal[2]).applyMatrix3(this.normalMatrix).normalize();
    for (let k = 0; k < 6; k++) {
      this.v.set(corners[k][0], corners[k][1], corners[k][2]).applyMatrix4(this.m);
      this.pos.push(this.v.x, this.v.y, this.v.z);
      this.nor.push(this.n.x, this.n.y, this.n.z);
      this.uv.push(uvs[k][0], uvs[k][1]);
    }
  }

  public get count(): number {
    return this.pos.length / 18;
  }

  public build(name = 'shelf goods'): THREE.Mesh {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: goodsAtlas().texture, roughness: 0.55, metalness: 0, alphaTest: 0.5, side: THREE.DoubleSide }));
    mesh.name = name;
    return mesh;
  }
}

/** Which goods go together on one gondola run, top shelf to bottom */
export const AISLES: Record<string, GoodsName[][]> = {
  staples: [['semolina', 'riceSmall', 'oats'], ['spaghetti', 'noodles', 'noodlesBlue'], ['seasoning', 'tomato', 'sardine'], ['riceSmall', 'semolina', 'custard'], ['rice', 'garri', 'beans', 'flour']],
  breakfast: [['cocoa', 'tea', 'honey'], ['cornflakes', 'oats', 'cornflakes'], ['milkTin', 'milkPowder', 'custard'], ['milkPowder', 'cocoa', 'groundnut'], ['sweets', 'pepper', 'honey']],
  drinks: [['water', 'cola', 'orange'], ['lemon', 'cola', 'water'], ['malt', 'energy', 'malt'], ['juice', 'juice', 'yoghurt'], ['wine', 'stout', 'beer']],
  snacks: [['biscuits', 'chinchin', 'plantain'], ['sweets', 'biscuits', 'groundnut'], ['chinchin', 'plantain', 'biscuits'], ['palmOil', 'vegOil', 'palmOil'], ['vegOil', 'palmOil', 'vegOil']],
  home: [['soap', 'soapGreen', 'toothpaste'], ['lotion', 'hairCream', 'insecticide'], ['detergent', 'bleach', 'detergent'], ['tissue', 'diapers'], ['detergentRed', 'tissue', 'detergentRed']],
  bakery: [['bread', 'breadSliced', 'bread'], ['breadSliced', 'bread', 'breadSliced'], ['biscuits', 'chinchin', 'sweets'], ['bread', 'bread', 'breadSliced']],
};

/**
 * One side of a shelf run filled with goods: `levels` are the shelf heights from the floor, the
 * run starts at `from` and goes `length` along its direction (yaw + π/2), its goods facing `yaw`.
 * Each shelf takes its goods from `rows` in turn, a metre-ish block each.
 */
export function stockRun(goods: GoodsMesh, rows: GoodsName[][], levels: number[], from: [number, number], length: number, yaw: number, depth = 0.38, gap = 0.36): void {
  const along: [number, number] = [Math.cos(yaw), -Math.sin(yaw)];
  const blocks = Math.max(1, Math.round(length / 0.95));
  const each = length / blocks;
  levels.forEach((y, r) => {
    const row = rows[r % rows.length];
    const h = Math.min(gap, (levels[r + 1] ?? y + gap + 0.08) - y - 0.06);
    for (let i = 0; i < blocks; i++) {
      const name = row[i % row.length];
      // Big sacks and tall packs nearly fill the shelf; sachets are low
      const shape = DESIGNS[name].shape;
      const tall = shape === 'sack' ? h : shape === 'sachet' ? h * 0.75 : shape === 'tin' ? h * 0.85 : h * 0.92;
      const t = (i + 0.5) * each;
      goods.add(name, each - 0.02, tall, depth, from[0] + along[0] * t, y, from[1] + along[1] * t, yaw);
    }
  });
}
