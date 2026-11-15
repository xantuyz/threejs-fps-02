// Grenades (Granat Guntur): thrown on an arc, one bounce, then a radial blast
// after 1.6 s. Damage 90 at the centre (r 1.5 m) down to 15 at the edge (r 5 m),
// blocked by walls (a raycast from the blast to each victim's chest). One small
// pool — at most 4 live grenades — so nothing is allocated per throw.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { emitSound } from './state.js';

const MAX_GRENADES = 4;
const FUSE_SECONDS = 1.6;
const BLAST_RADIUS = 5;
const BLAST_CENTER = 1.5;
const DAMAGE_CENTER = 90;
const DAMAGE_EDGE = 15;
const GRAVITY = 12;

export function createProjectiles(scene, world, state, combat, player, effects, hooks) {
  const raycaster = new THREE.Raycaster();
  raycaster.far = 80;
  const direction = new THREE.Vector3();
  const chest = new THREE.Vector3();

  const geo = new THREE.SphereGeometry(0.09, 10, 8);
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), emissive: new THREE.Color(PALETTE.accent), emissiveIntensity: 0.5, roughness: 0.4 });
  const pool = [];
  for (let i = 0; i < MAX_GRENADES; i += 1) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    scene.add(mesh);
    pool.push({ mesh, active: false, velocity: new THREE.Vector3(), fuse: 0, bounced: false });
  }

  function hasLineOfSight(from, to) {
    direction.copy(to).sub(from);
    const distance = direction.length();
    direction.normalize();
    raycaster.set(from, direction);
    const hits = raycaster.intersectObjects(world.shootables, false);
    return !hits[0] || hits[0].distance > distance - 0.2;
  }

  function explode(grenade) {
    grenade.active = false;
    grenade.mesh.visible = false;
    const at = grenade.mesh.position;
    effects.blastAt(at);
    emitSound(state, at.x, at.z, 30, 'blast');
    if (hooks && hooks.onBlast) hooks.onBlast(at);
    const bots = hooks.getBots();
    for (const bot of bots) {
      if (!bot.alive) continue;
      chest.set(bot.body.position.x, bot.body.position.y + 1.15, bot.body.position.z);
      const distance = Math.hypot(chest.x - at.x, chest.z - at.z);
      if (distance > BLAST_RADIUS || !hasLineOfSight(at, chest)) continue;
      const t = Math.max(0, (distance - BLAST_CENTER) / (BLAST_RADIUS - BLAST_CENTER));
      const damage = Math.round(DAMAGE_CENTER + (DAMAGE_EDGE - DAMAGE_CENTER) * t);
      combat.damageBot(bot, damage, { isPlayer: true, name: 'Kamu', weaponId: 'rajawali' }, 'torso');
    }
    // The player can hurt themself with a close blast.
    chest.set(player.state.position.x, player.state.position.y + 1.15, player.state.position.z);
    const distance = Math.hypot(chest.x - at.x, chest.z - at.z);
    if (distance <= BLAST_RADIUS && hasLineOfSight(at, chest) && player.state.health > 0) {
      const t = Math.max(0, (distance - BLAST_CENTER) / (BLAST_RADIUS - BLAST_CENTER));
      const damage = Math.round(DAMAGE_CENTER + (DAMAGE_EDGE - DAMAGE_CENTER) * t);
      combat.damagePlayer(damage, { name: 'Granat Guntur', weaponId: 'rajawali' });
    }
  }

  function throwGrenade(from, baseDir) {
    const slot = pool.find((g) => !g.active);
    if (!slot) return false;
    slot.active = true;
    slot.fuse = FUSE_SECONDS;
    slot.bounced = false;
    slot.mesh.visible = true;
    slot.mesh.position.copy(from);
    slot.velocity.copy(baseDir).multiplyScalar(14);
    slot.velocity.y += 4;
    return true;
  }

  function step(dt) {
    for (const grenade of pool) {
      if (!grenade.active) continue;
      grenade.fuse -= dt;
      grenade.velocity.y -= GRAVITY * dt;
      grenade.mesh.position.addScaledVector(grenade.velocity, dt);
      if (grenade.mesh.position.y <= 0.09) {
        grenade.mesh.position.y = 0.09;
        if (!grenade.bounced) {
          grenade.velocity.y = Math.abs(grenade.velocity.y) * 0.5;
          grenade.velocity.x *= 0.7;
          grenade.velocity.z *= 0.7;
          grenade.bounced = true;
        } else {
          grenade.velocity.y = 0;
        }
      }
      if (grenade.fuse <= 0) explode(grenade);
    }
  }

  return { throwGrenade, step };
}
