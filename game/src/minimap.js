// Minimap + compass (v2): a top-down map of Dermaga Meridian and a heading
// strip, both drawn on 2D canvases from the same data the game runs on —
// walls from MINIMAP_WALLS, sites from SITES, the player's yaw from the
// camera. Enemies only appear while a teammate can see them (their position
// is refreshed by bots.js sight checks); the Pulsar marker shows whenever it
// is dropped or planted. Redrawn ~4 times a second from main.js; cheap
// (a few dozen rects) and allocation-free after the first frame.
import { MINIMAP_WALLS, SITES } from './world.js';
import { PALETTE } from './palette.js';

// Map bounds: the playable area plus a small margin.
const MAP_MIN_X = -34;
const MAP_MAX_X = 34;
const MAP_MIN_Z = -26;
const MAP_MAX_Z = 26;

export function createMinimap() {
  const mapCanvas = document.getElementById('minimap');
  const mapCtx = mapCanvas.getContext('2d');
  const compCanvas = document.getElementById('compass');
  const compCtx = compCanvas.getContext('2d');
  const mapW = mapCanvas.width;
  const mapH = mapCanvas.height;
  const scaleX = mapW / (MAP_MAX_X - MAP_MIN_X);
  const scaleZ = mapH / (MAP_MAX_Z - MAP_MIN_Z);
  const toMapX = (x) => (x - MAP_MIN_X) * scaleX;
  const toMapZ = (z) => (z - MAP_MIN_Z) * scaleZ;

  function dot(x, z, radius, color) {
    mapCtx.fillStyle = color;
    mapCtx.beginPath();
    mapCtx.arc(toMapX(x), toMapZ(z), radius, 0, Math.PI * 2);
    mapCtx.fill();
  }

  function drawMap(snapshot) {
    mapCtx.clearRect(0, 0, mapW, mapH);
    mapCtx.fillStyle = PALETTE.surface;
    mapCtx.fillRect(0, 0, mapW, mapH);
    // Site tints: A amber, B teal — the same colours as the floor decals.
    for (const key of ['A', 'B']) {
      const site = SITES[key];
      mapCtx.fillStyle = PALETTE[site.color];
      mapCtx.globalAlpha = 0.28;
      mapCtx.fillRect(toMapX(site.minX), toMapZ(site.minZ),
        (site.maxX - site.minX) * scaleX, (site.maxZ - site.minZ) * scaleZ);
      mapCtx.globalAlpha = 1;
    }
    // Walls from the real layout table.
    mapCtx.fillStyle = PALETTE.hairline;
    for (const wall of MINIMAP_WALLS) {
      mapCtx.fillRect(toMapX(wall.x), toMapZ(wall.z),
        Math.max(1, wall.w * scaleX), Math.max(1, wall.d * scaleZ));
    }
    // Site letters.
    mapCtx.fillStyle = PALETTE.ink;
    mapCtx.font = 'bold 11px system-ui, sans-serif';
    mapCtx.textAlign = 'center';
    mapCtx.textBaseline = 'middle';
    mapCtx.fillText('A', toMapX(SITES.A.cx), toMapZ(SITES.A.cz));
    mapCtx.fillText('B', toMapX(SITES.B.cx), toMapZ(SITES.B.cz));
    // Pulsar marker when it is dropped or planted.
    if (snapshot.pulsar && (snapshot.pulsar.state === 'dropped' || snapshot.pulsar.state === 'planted')) {
      dot(snapshot.pulsar.x, snapshot.pulsar.z, 4, PALETTE.accent);
      mapCtx.strokeStyle = PALETTE.accent;
      mapCtx.lineWidth = 1;
      mapCtx.beginPath();
      mapCtx.arc(toMapX(snapshot.pulsar.x), toMapZ(snapshot.pulsar.z), 6, 0, Math.PI * 2);
      mapCtx.stroke();
    }
    // Allies (amber dots), visible enemies (red dots).
    for (const ally of snapshot.allies) dot(ally.x, ally.z, 3, PALETTE.accent);
    for (const enemy of snapshot.enemies) dot(enemy.x, enemy.z, 3, PALETTE.danger);
    // The player: a white arrow that turns with the camera yaw. The arrow is
    // drawn pointing up (map north, -Z); rotating the canvas by -yaw turns it
    // to the facing vector (-sin yaw, -cos yaw).
    const px = toMapX(snapshot.player.x);
    const pz = toMapZ(snapshot.player.z);
    mapCtx.save();
    mapCtx.translate(px, pz);
    mapCtx.rotate(-snapshot.player.yaw);
    mapCtx.fillStyle = PALETTE.ink;
    mapCtx.beginPath();
    mapCtx.moveTo(0, -7);
    mapCtx.lineTo(5, 5);
    mapCtx.lineTo(-5, 5);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.restore();
  }

  function drawCompass(snapshot) {
    const w = compCanvas.width;
    const h = compCanvas.height;
    compCtx.clearRect(0, 0, w, h);
    compCtx.fillStyle = PALETTE.surface;
    compCtx.globalAlpha = 0.92;
    compCtx.fillRect(0, 0, w, h);
    compCtx.globalAlpha = 1;
    // yaw 0 faces -Z (north). Heading in degrees, 0 = N, 90 = E, 180 = S, 270 = W.
    const heading = ((-snapshot.player.yaw * 180) / Math.PI % 360 + 360) % 360;
    const pxPerDeg = w / 180; // show a 180° window centred on the heading
    const marker = (deg, label, color) => {
      let delta = ((deg - heading + 540) % 360) - 180;
      if (delta < -90 || delta > 90) return;
      const x = w / 2 + delta * pxPerDeg;
      compCtx.fillStyle = color;
      compCtx.font = 'bold 11px system-ui, sans-serif';
      compCtx.textAlign = 'center';
      compCtx.textBaseline = 'middle';
      compCtx.fillText(label, x, h / 2);
    };
    marker(0, 'N', PALETTE.ink);
    marker(90, 'E', PALETTE.ink);
    marker(180, 'S', PALETTE.ink);
    marker(270, 'W', PALETTE.ink);
    // Site bearings, from the player's position.
    for (const key of ['A', 'B']) {
      const site = SITES[key];
      const dx = site.cx - snapshot.player.x;
      const dz = site.cz - snapshot.player.z;
      const bearing = ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360;
      marker(bearing, key, PALETTE[site.color]);
    }
    if (snapshot.pulsar && (snapshot.pulsar.state === 'dropped' || snapshot.pulsar.state === 'planted')) {
      const dx = snapshot.pulsar.x - snapshot.player.x;
      const dz = snapshot.pulsar.z - snapshot.player.z;
      const bearing = ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360;
      marker(bearing, '◆', PALETTE.accent);
    }
    // Centre tick: the exact heading.
    compCtx.fillStyle = PALETTE.accent;
    compCtx.fillRect(w / 2 - 1, 0, 2, 5);
  }

  return {
    draw(snapshot) {
      drawMap(snapshot);
      drawCompass(snapshot);
    },
  };
}
