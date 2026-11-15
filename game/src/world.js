// Dermaga Meridian: a harbour cargo terminal at dusk, 64 x 48 m.
// Two sites (A "Dermaga" west, B "Gudang" east) at the north end, three
// north-south lanes (A / Mid / B), Arunika spawn south, Meridian spawn north.
// Every box is both a collider and a surface bullets stop on. Built from one
// data table so the layout reads as data, not as a wall of box() calls.
//
//   N (Meridian spawn, z -20)
//   +----------------+----------------+----------------+
//   |  SITE A        |     MID top    |  SITE B        |
//   |  DERMAGA       |  (spawn behind)|  GUDANG        |
//   +----------------+----------------+----------------+
//   |  LANE A        |     MID        |  LANE B        |
//   |  (containers)  |  (long sight)  |  (tank)        |
//   +----------------+----------------+----------------+
//   |        ARUNIKA SPAWN (z +20)                     |
//   S
import * as THREE from 'three';
import { PALETTE } from './palette.js';

// [width, height, depth, x, y, z, material] — y is the box centre.
const BOXES = [
  // Floor zones, coloured per area so a glance tells you where you are.
  [64.4, 0.4, 48.4, 0, -0.2, 0, 'surface'],
  // Perimeter walls (4.6 m).
  [0.4, 4.6, 48.4, -32.2, 2.3, 0, 'surface'],
  [0.4, 4.6, 48.4, 32.2, 2.3, 0, 'surface'],
  [64.4, 4.6, 0.4, 0, 2.3, -24.2, 'surface'],
  [64.4, 4.6, 0.4, 0, 2.3, 24.2, 'surface'],
  // Lane dividers x = -12 / +12, z -8..22, with a cross gap at z 6..10.
  [0.5, 3.4, 14, -12, 1.7, -1, 'hairline'],
  [0.5, 3.4, 12, -12, 1.7, 16, 'hairline'],
  [0.5, 3.4, 14, 12, 1.7, -1, 'hairline'],
  [0.5, 3.4, 12, 12, 1.7, 16, 'hairline'],
  // Site wall z = -8 with lane gaps (A gap x -20..-16, B gap x 16..20). The
  // gaps are the rush lanes' doors — without them no attacker walking lane A
  // or B can ever reach a site, and rounds stall on the clock (v2 fix).
  [12, 3.4, 0.5, -26, 1.7, -8, 'hairline'],
  [4, 3.4, 0.5, -14, 1.7, -8, 'hairline'],
  [8, 3.4, 0.5, -8, 1.7, -8, 'hairline'],
  [8, 3.4, 0.5, 8, 1.7, -8, 'hairline'],
  [4, 3.4, 0.5, 14, 1.7, -8, 'hairline'],
  [12, 3.4, 0.5, 26, 1.7, -8, 'hairline'],
  // Tall containers (2.6 m — block sight fully) on the sites and in Mid.
  [6, 2.6, 2.4, -26, 1.3, -19, 'rust'],
  [6, 2.6, 2.4, -15, 1.3, -11, 'hairline'],
  [6, 2.6, 2.4, 26, 1.3, -19, 'rust'],
  [6, 2.6, 2.4, 15, 1.3, -11, 'hairline'],
  [3, 2.6, 2.4, -1.5, 1.3, -4, 'rust'],
  [3, 2.6, 2.4, 1.5, 1.3, 4, 'hairline'],
  [6, 2.6, 2.4, -26, 1.3, 8, 'hairline'],
  [6, 2.6, 2.4, 26, 1.3, 8, 'rust'],
  [4, 2.6, 2.4, -20, 1.3, 12, 'ink'],
  [4, 2.6, 2.4, 20, 1.3, 12, 'ink'],
  // Low crates (0.9-1.1 m — crouch cover, head visible when standing).
  // Low crates marking the sites. They sit in the site corners, OFF the site
  // centre nodes (7/20) — a crate on the node itself wedges every bot walking
  // to it, because the 0.9 m arrival radius can never be reached (v2 fix).
  [2.4, 0.9, 1.2, -26, 0.45, -11, 'rust'],
  [2.4, 0.9, 1.2, 26, 0.45, -11, 'rust'],
  [1.6, 1.1, 1.6, -20, 0.55, 0, 'hairline'],
  [1.6, 1.1, 1.6, 20, 0.55, 0, 'hairline'],
  [2.4, 0.9, 1.2, -6, 0.45, 18, 'hairline'],
  [2.4, 0.9, 1.2, 6, 0.45, 18, 'hairline'],
  [1.6, 1.1, 1.6, -4, 0.55, -14, 'hairline'],
  [1.6, 1.1, 1.6, 4, 0.55, -14, 'hairline'],
  // Spawn cover + warehouse platforms (1.2 m, reached by box steps).
  [6, 0.5, 2.4, -4, 0.25, 22, 'surface'],
  [6, 0.5, 2.4, 4, 0.25, 22, 'surface'],
  [4, 1.2, 3, -28, 0.6, -20, 'surface'],
  [4, 1.2, 3, 28, 0.6, -20, 'surface'],
  [1.2, 0.6, 1.2, -28, 0.3, -17.5, 'hairline'],
  [1.2, 0.6, 1.2, 28, 0.3, -17.5, 'hairline'],
];

// The minimap (v2) draws the same box table as flat rectangles, so the map
// always matches the real walls. Floors (height 0.4) are skipped.
export const MINIMAP_WALLS = BOXES.filter((b) => b[1] > 0.4)
  .map((b) => ({ x: b[3] - b[0] / 2, z: b[5] - b[2] / 2, w: b[0], d: b[2] }));

// Floor tints: thin coloured planes that mark the zones. They are MESHES ONLY —
// never colliders or shootables, or they would block every step on the map
// (a 0.06 m lip still intersects the walker's horizontal probe).
const DECALS = [
  [16, 14, -20, -15, 'accent'], // Site A floor tint (sand-amber)
  [16, 14, 20, -15, 'teal'], // Site B floor tint (ash-teal)
  [8, 48, 0, 0, 'hairline'], // Mid asphalt strip
];

// Cylinders: two big tanks (r 2, h 4) as round landmarks. Cylinders get a
// box collider slightly smaller than the visual so players slide around them.
const TANKS = [
  [-28, -2, 'teal'],
  [28, -2, 'teal'],
];

export const SITES = {
  A: { name: 'DERMAGA', minX: -28, maxX: -12, minZ: -22, maxZ: -8, cx: -20, cz: -15, color: 'accent' },
  B: { name: 'GUDANG', minX: 12, maxX: 28, minZ: -22, maxZ: -8, cx: 20, cz: -15, color: 'teal' },
};

export const SPAWNS = {
  // All spots clear of the spawn platforms (z 20.8..23.2): the mover resolves
  // vertical hits against the first collider (the floor), so a spawn inside a
  // 0.5 m platform's footprint would wedge the walker there forever.
  arunika: [[-5, 20], [0, 20], [5, 20], [-2, 19.5], [2, 19.5]],
  meridian: [[-5, -20], [0, -20], [5, -20], [-2, -19.5], [2, -19.5]],
};

function makeSignTexture(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1e2228';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 500, 116);
  ctx.fillStyle = color;
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 68);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createWorld(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const materials = {};
  for (const name of Object.keys(PALETTE)) {
    materials[name] = new THREE.MeshStandardMaterial({
      color: new THREE.Color(PALETTE[name]),
      roughness: name === 'accent' || name === 'ink' ? 0.55 : 0.92,
      metalness: name === 'teal' ? 0.4 : 0.03,
    });
  }

  const colliders = [];
  const shootables = [];

  function box(width, height, depth, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), materials[material]);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    colliders.push(new THREE.Box3().setFromObject(mesh));
    shootables.push(mesh);
    return mesh;
  }

  for (const [w, h, d, x, y, z, material] of BOXES) box(w, h, d, x, y, z, material);

  // Zone tints: flat planes just above the floor, no collision, no bullet stop.
  for (const [w, d, x, z, material] of DECALS) {
    const tint = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE[material]), roughness: 0.95, metalness: 0.03 }),
    );
    tint.rotation.x = -Math.PI / 2;
    tint.position.set(x, 0.02, z);
    tint.receiveShadow = true;
    group.add(tint);
  }

  // Tanks: cylinder visual + slightly smaller box collider.
  for (const [x, z, material] of TANKS) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 4, 20), materials[material]);
    mesh.position.set(x, 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    shootables.push(mesh);
    const collider = new THREE.Box3(
      new THREE.Vector3(x - 1.8, 0, z - 1.8),
      new THREE.Vector3(x + 1.8, 4, z + 1.8),
    );
    colliders.push(collider);
  }

  // Site signage, drawn once at load (procedural canvas texture, no files).
  for (const key of Object.keys(SITES)) {
    const site = SITES[key];
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 1.25),
      new THREE.MeshBasicMaterial({ map: makeSignTexture(`${key} — ${site.name}`, PALETTE[site.color]) }),
    );
    sign.position.set(site.cx, 3.2, -23.8);
    group.add(sign);
    // Plant-zone outline on the floor.
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 7),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE[site.color]), transparent: true, opacity: 0.16, depthWrite: false }),
    );
    line.rotation.x = -Math.PI / 2;
    line.position.set(site.cx, 0.07, site.cz);
    group.add(line);
  }

  // Dusk lighting: warm low key from the south-west, cool teal fill from the east.
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(new THREE.Color('#1a1410'), 30, 90);
  const sky = new THREE.HemisphereLight(new THREE.Color(PALETTE.sky), new THREE.Color(PALETTE.surface), 0.9);
  scene.add(sky);

  const key = new THREE.DirectionalLight(new THREE.Color('#ffb36b'), 2.0);
  key.position.set(-30, 18, 28);
  key.target.position.set(0, 0, -4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -36;
  key.shadow.camera.right = 36;
  key.shadow.camera.top = 36;
  key.shadow.camera.bottom = -36;
  key.shadow.camera.far = 90;
  key.shadow.bias = -0.0006;
  scene.add(key, key.target);

  const fill = new THREE.DirectionalLight(new THREE.Color(PALETTE.teal), 0.4);
  fill.position.set(28, 12, -10);
  scene.add(fill);

  // One point light per site, one in Mid, one at the Arunika spawn.
  const points = [
    [-20, 3, -15, PALETTE.accent],
    [20, 3, -15, PALETTE.teal],
    [0, 3, 0, PALETTE.teal],
    [0, 3, 20, PALETTE.sky],
  ];
  for (const [x, y, z, color] of points) {
    const light = new THREE.PointLight(new THREE.Color(color), 14, 18, 1.6);
    light.position.set(x, y, z);
    scene.add(light);
  }

  return { colliders, shootables, group, sites: SITES, spawns: SPAWNS };
}
