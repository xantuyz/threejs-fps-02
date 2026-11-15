// Combat: the one hitscan path for player and bots. A shot is a ray from an eye
// position along a spread direction; the nearest hit wins, walls block, heads
// pay x4 (x2 per shotgun pellet), damage falls off with distance. The player is
// tested as two spheres (torso r 0.5, head r 0.25) on the same ray, so bots use
// exactly the same function as the player. Kills pay +¢300, feed the kill feed,
// and drop the Pulsar when the carrier dies. One Raycaster and a handful of
// vectors are reused — no allocation in shoot().
import * as THREE from 'three';
import { WEAPONS } from './weapons.js';
import { addKillFeed, emitSound } from './state.js';

export function createCombat(scene, world, effects, state, getBots, player) {
  const raycaster = new THREE.Raycaster();
  raycaster.far = 80;
  const direction = new THREE.Vector3();
  const origin = new THREE.Vector3();
  const hitPoint = new THREE.Vector3();
  const toTarget = new THREE.Vector3();
  const endPoint = new THREE.Vector3();

  function damageFor(def, part, distance) {
    let damage = def.damage;
    if (distance > def.falloffStart) {
      const t = Math.min(1, (distance - def.falloffStart) / (def.falloffEnd - def.falloffStart));
      damage = def.damage + (def.falloffMin - def.damage) * t;
    }
    return Math.round(damage * (part === 'head' ? def.headMult : 1));
  }

  // shootables = world surfaces + every living bot's hit meshes. Built into a
  // scratch array each call — never push into world.shootables, or it grows
  // forever. The shooter's own meshes are excluded so a bot cannot hit itself.
  const scratch = [];
  function buildShootables(bots, excludeBot) {
    scratch.length = 0;
    for (const mesh of world.shootables) scratch.push(mesh);
    for (const bot of bots) {
      if (!bot.alive || bot === excludeBot) continue;
      scratch.push(bot.torsoMesh, bot.headMesh);
    }
    return scratch;
  }

  // Closest approach of the ray to a point: returns t along the ray, or -1.
  function rayNearPoint(px, py, pz, radius) {
    toTarget.set(px - origin.x, py - origin.y, pz - origin.z);
    const t = toTarget.dot(direction);
    if (t < 0 || t > 80) return -1;
    const closestX = origin.x + direction.x * t;
    const closestY = origin.y + direction.y * t;
    const closestZ = origin.z + direction.z * t;
    const dx = px - closestX;
    const dy = py - closestY;
    const dz = pz - closestZ;
    return dx * dx + dy * dy + dz * dz < radius * radius ? t : -1;
  }

  // Fire one trigger pull from `from` (a Vector3 eye) along `baseDir` with the
  // given weapon id and spread. `shooter` is { side, name, isPlayer, weaponId }.
  // Returns { hit, killed, headshot, damage }.
  function shoot(from, baseDir, weaponId, spread, shooter, random) {
    const def = WEAPONS[weaponId];
    const bots = getBots();
    const list = buildShootables(bots, shooter.bot || null);
    let hitSomething = false;
    let killed = false;
    let headshot = false;
    let totalDamage = 0;
    for (let pellet = 0; pellet < def.pellets; pellet += 1) {
      direction.copy(baseDir);
      direction.x += (random() * 2 - 1) * spread;
      direction.y += (random() * 2 - 1) * spread;
      direction.z += (random() * 2 - 1) * spread;
      direction.normalize();
      origin.copy(from);
      raycaster.set(origin, direction);
      const hits = raycaster.intersectObjects(list, false);
      const first = hits[0];
      const wallDist = first ? first.distance : 80;
      // The player has no mesh in the list, so test the ray against the
      // player's torso/head spheres before anything the ray already hit.
      let playerPart = null;
      let playerT = -1;
      if (!shooter.isPlayer && player.state.health > 0) {
        const px = player.state.position.x;
        const py = player.state.position.y;
        const pz = player.state.position.z;
        const headT = rayNearPoint(px, py + 1.55, pz, 0.28);
        const torsoT = rayNearPoint(px, py + 1.15, pz, 0.5);
        if (headT >= 0 && headT < wallDist) { playerPart = 'head'; playerT = headT; }
        else if (torsoT >= 0 && torsoT < wallDist) { playerPart = 'torso'; playerT = torsoT; }
      }
      if (playerPart) {
        const damage = damageFor(def, playerPart, playerT);
        totalDamage += damage;
        hitSomething = true;
        if (playerPart === 'head') headshot = true;
        endPoint.copy(origin).addScaledVector(direction, playerT);
        effects.tracer(from, endPoint);
        if (damagePlayer(damage, shooter)) killed = true;
        continue;
      }
      if (!first) {
        endPoint.copy(origin).addScaledVector(direction, 30);
        effects.tracer(from, endPoint);
        continue;
      }
      hitPoint.copy(first.point);
      effects.tracer(from, hitPoint);
      const target = first.object.userData.bot;
      if (target && target.alive && target.side !== shooter.side) {
        const part = first.object.userData.part;
        const damage = damageFor(def, part, first.distance);
        totalDamage += damage;
        hitSomething = true;
        if (part === 'head') headshot = true;
        if (damageBot(target, damage, shooter, part)) killed = true;
      } else if (target && target.alive) {
        // Friendly fire is off: the ray stops on the teammate.
        hitSomething = true;
      } else {
        effects.spark(hitPoint);
        hitSomething = true;
      }
    }
    if (def.pellets > 0) emitSound(state, from.x, from.z, 25, 'shot');
    return { hit: hitSomething, killed, headshot, damage: totalDamage };
  }

  function damageBot(bot, amount, shooter, part) {
    bot.health -= amount;
    bot.lastDamageAt = state.elapsed;
    if (bot.health > 0) return false;
    bot.alive = false;
    bot.health = 0;
    bot.fall = 0;
    const shooterName = shooter.isPlayer ? 'Kamu' : shooter.name;
    addKillFeed(state, `${shooterName} ▸ ${bot.name} [${WEAPONS[shooter.weaponId || 'rajawali'].name}]${part === 'head' ? ' ✕ HEADSHOT' : ''}`, part === 'head');
    if (shooter.isPlayer) {
      state.kills += 1;
      state.money = Math.min(9000, state.money + 300);
    }
    if (state.pulsar.carrier === bot.id) dropPulsar(bot);
    return true;
  }

  function dropPulsar(bot) {
    state.pulsar.state = 'dropped';
    state.pulsar.carrier = null;
    state.pulsar.x = bot.body.position.x;
    state.pulsar.z = bot.body.position.z;
  }

  // Damage the player from a bot shot. Returns true when the player dies.
  function damagePlayer(amount, shooter) {
    if (player.state.health <= 0) return false;
    player.state.health -= amount;
    if (player.state.health > 0) return false;
    player.state.health = 0;
    state.deaths += 1;
    addKillFeed(state, `${shooter.name} ▸ Kamu [${WEAPONS[shooter.weaponId].name}]`, false);
    if (state.pulsar.carrier === 'player') {
      state.pulsar.state = 'dropped';
      state.pulsar.carrier = null;
      state.pulsar.x = player.state.position.x;
      state.pulsar.z = player.state.position.z;
    }
    return true;
  }

  return { shoot, damageBot, damagePlayer, damageFor };
}
