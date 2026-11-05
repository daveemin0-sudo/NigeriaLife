import * as THREE from 'three';
import type { Product, ProductShape, ShelfSectionDef } from './ShopCatalog';

const shelfBodyMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.55 });
const shelfBoardMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
const fridgeBodyMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.3, metalness: 0.2 });
const fridgeInsideMat = new THREE.MeshBasicMaterial({ color: 0xdff4ff });
const counterMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.5 });
const counterTopMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
const basketMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 });
const bagMat = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.75 });
const bagPrintMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.6 });

export const SHELF = { width: 4.4, depth: 0.7, height: 2.1 };
export const COUNTER = { width: 3.4, depth: 0.9, height: 0.95 };
/** Units of each product on show when the shop opens */
export const STOCK_PER_PRODUCT = 6;
/** Most things one basket takes */
export const BASKET_LIMIT = 8;

const productGeometries: Record<ProductShape, THREE.BufferGeometry> = {
  box: new THREE.BoxGeometry(0.2, 0.28, 0.14),
  bottle: new THREE.CylinderGeometry(0.035, 0.062, 0.3, 10),
  can: new THREE.CylinderGeometry(0.062, 0.062, 0.17, 12),
  loaf: new THREE.BoxGeometry(0.3, 0.15, 0.15),
  pack: new THREE.BoxGeometry(0.24, 0.2, 0.09),
};
const productHeights: Record<ProductShape, number> = { box: 0.28, bottle: 0.3, can: 0.17, loaf: 0.15, pack: 0.2 };
const productMaterials = new Map<string, THREE.MeshStandardMaterial>();

/** One unit of a product: the thing on the shelf, in the basket and on the counter. */
export function createProductMesh(product: Product): THREE.Mesh {
  let material = productMaterials.get(product.id);
  if (!material) {
    material = new THREE.MeshStandardMaterial({ color: product.color, roughness: 0.55 });
    productMaterials.set(product.id, material);
  }
  const mesh = new THREE.Mesh(productGeometries[product.shape], material);
  mesh.name = `product_${product.id}`;
  mesh.userData.height = productHeights[product.shape];
  return mesh;
}

function signTexture(text: string, icon: string, background: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 512, 96);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 46px Inter, system-ui, sans-serif';
  ctx.fillText(`${icon}  ${text.toUpperCase()}`, 256, 50, 490);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export interface ShelfUnit {
  group: THREE.Group;
  /** Units on show for each product, in the order they are taken */
  stock: Map<string, THREE.Mesh[]>;
}

/**
 * A shelf unit holding one section of the shop. It faces local +Z; products stand in four
 * columns, two shelves high, so what is left of each can be seen from across the room.
 */
export function createShelfUnit(section: ShelfSectionDef, fridge: boolean): ShelfUnit {
  const group = new THREE.Group();
  group.name = `shop_shelf_${section.id}`;
  const stock = new Map<string, THREE.Mesh[]>();
  const { width, depth, height } = SHELF;

  const back = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.08), fridge ? fridgeBodyMat : shelfBodyMat);
  back.position.set(0, height / 2, -depth / 2 + 0.04);
  group.add(back);
  for (const side of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.08, height, depth), fridge ? fridgeBodyMat : shelfBodyMat);
    panel.position.set(side * (width / 2 - 0.04), height / 2, 0);
    group.add(panel);
  }
  if (fridge) {
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.2, height - 0.5), fridgeInsideMat);
    glow.position.set(0, height / 2 - 0.05, -depth / 2 + 0.09);
    group.add(glow);
  }

  const levels = [0.55, 1.15];
  for (const y of [0.12, ...levels.map((level) => level - 0.03), height - 0.3]) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(width - 0.16, 0.05, depth - 0.06), fridge ? fridgeBodyMat : shelfBoardMat);
    board.position.set(0, y, 0.02);
    group.add(board);
  }

  // Name board along the top, readable from the aisle
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(width - 0.2, 0.42),
    new THREE.MeshBasicMaterial({ map: signTexture(section.name, section.icon, fridge ? '#0369a1' : '#1e3a8a') })
  );
  sign.position.set(0, height - 0.03, depth / 2 + 0.01);
  group.add(sign);

  const columnWidth = (width - 0.3) / section.products.length;
  section.products.forEach((product, column) => {
    const units: THREE.Mesh[] = [];
    const centerX = -width / 2 + 0.15 + columnWidth * (column + 0.5);
    const perLevel = STOCK_PER_PRODUCT / levels.length;
    // Taken from the top shelf first, front to back, so the gap is easy to see
    for (let level = levels.length - 1; level >= 0; level--) {
      for (let i = 0; i < perLevel; i++) {
        const unit = createProductMesh(product);
        const spread = (i - (perLevel - 1) / 2) * Math.min(0.3, (columnWidth - 0.2) / perLevel + 0.12);
        unit.position.set(centerX + spread, levels[level] + (unit.userData.height as number) / 2, 0.14);
        group.add(unit);
        units.push(unit);
      }
    }
    stock.set(product.id, units);
  });

  return { group, stock };
}

/** A hand basket. Things put in it sit in two layers of six. */
export interface Basket {
  group: THREE.Group;
  /** Where the nth thing in the basket goes, relative to the basket */
  slot: (index: number) => THREE.Vector3;
}

export function createBasket(): Basket {
  const group = new THREE.Group();
  group.name = 'shop_basket';
  const w = 0.5;
  const d = 0.34;
  const h = 0.2;
  const base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.025, d), basketMat);
  base.position.y = 0.012;
  group.add(base);
  for (const side of [-1, 1]) {
    const long = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.02), basketMat);
    long.position.set(0, h / 2, side * (d / 2 - 0.01));
    group.add(long);
    const short = new THREE.Mesh(new THREE.BoxGeometry(0.02, h, d), basketMat);
    short.position.set(side * (w / 2 - 0.01), h / 2, 0);
    group.add(short);
  }
  const handle = new THREE.Mesh(new THREE.TorusGeometry(d / 2 - 0.02, 0.012, 6, 14, Math.PI), darkMat);
  handle.rotation.y = Math.PI / 2;
  handle.position.y = h;
  group.add(handle);

  return {
    group,
    slot(index: number) {
      const layer = Math.floor(index / 6);
      const cell = index % 6;
      return new THREE.Vector3(-0.15 + (cell % 3) * 0.15, 0.03 + layer * 0.12, -0.07 + Math.floor(cell / 3) * 0.14);
    },
  };
}

/** The stack of empty baskets by the door. */
export function createBasketStack(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'shop_basket_stack';
  for (let i = 0; i < 4; i++) {
    const basket = createBasket().group;
    basket.position.y = 0.12 + i * 0.07;
    group.add(basket);
  }
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.44), darkMat);
  stand.position.y = 0.06;
  group.add(stand);
  return group;
}

/** A carrier bag, what the cashier hands over once everything is paid for. */
export function createShoppingBag(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'shop_bag';
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.16), bagMat);
  body.position.y = 0.18;
  group.add(body);
  const print = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.165), bagPrintMat);
  print.position.y = 0.2;
  group.add(print);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.01, 6, 12, Math.PI), bagMat);
  handle.position.y = 0.36;
  group.add(handle);
  return group;
}

export interface CheckoutCounter {
  group: THREE.Group;
  /** Shows the running total on the till's screen */
  setDisplay: (text: string) => void;
}

/** The till: a counter that faces local +Z (the customer's side), with a screen the customer can read. */
export function createCheckoutCounter(): CheckoutCounter {
  const group = new THREE.Group();
  group.name = 'shop_checkout';
  const { width, depth, height } = COUNTER;

  const body = new THREE.Mesh(new THREE.BoxGeometry(width, height - 0.05, depth), counterMat);
  body.position.y = (height - 0.05) / 2;
  body.castShadow = true;
  group.add(body);
  const top = new THREE.Mesh(new THREE.BoxGeometry(width + 0.1, 0.05, depth + 0.1), counterTopMat);
  top.position.y = height - 0.025;
  group.add(top);

  // Till with a screen turned toward the customer
  const till = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.4), darkMat);
  till.position.set(width / 2 - 0.45, height + 0.1, -0.1);
  group.add(till);

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.18), new THREE.MeshBasicMaterial({ map: texture }));
  screen.position.set(width / 2 - 0.45, height + 0.34, 0.02);
  screen.rotation.x = -0.25;
  group.add(screen);
  const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.05), darkMat);
  stalk.position.set(width / 2 - 0.45, height + 0.24, -0.02);
  group.add(stalk);

  const setDisplay = (text: string) => {
    ctx.fillStyle = '#052e16';
    ctx.fillRect(0, 0, 256, 96);
    ctx.fillStyle = '#4ade80';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 44px ui-monospace, Consolas, monospace';
    ctx.fillText(text, 128, 50, 240);
    texture.needsUpdate = true;
  };
  setDisplay('WELCOME');

  return { group, setDisplay };
}
