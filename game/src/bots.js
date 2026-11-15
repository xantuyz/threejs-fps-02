// Bot AI: 9 humanoid bots, 5v5 with the player. State machine:
// PLAN -> MOVE (waypoint route) -> ENGAGE (seen enemy) -> HOLD, plus
// ROTATE (defenders move to the planted site), PLANT / DEFUSE (objective),
// RETREAT (low HP and outnumbered). Bots walk with the same createMover as
// the player, so they never clip through walls. Sight is a raycast from the
// eye to each enemy's chest, staggered 3 bots per tick; sound events turn
// heads and pull defenders to a site. Difficulty comes from the numbers in
// BOT_TUNING, not from bots that refuse to shoot.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createMover } from './player.js';
import { WEAPONS } from './weapons.js';
import { NODES, nearestNode, findPath, ATTACK_ROUTES, DEFENCE_POSTS, SITE_CENTERS } from './nav.js';
import { emitSound } from './state.js';
import { clamp } from './utils.js';

const BOT_TUNING = {
  reactionMin: 0.35, reactionMax: 0.7, // seconds before the first shot
  spreadMin: 0.01, spreadMax: 0.022, // radians, worse than a still player
  burstMin: 3, burstMax: 5, burstPauseMin: 0.3, burstPauseMax: 0.6,
  sightRange: 45, sightHalfAngle: 70, sightEvery: 0.15,
  moveSpeed: 4.8, memorySeconds: 2, hearShotRadius: 25,
};

const ALLY_NAMES = ['Bara', 'Cakra', 'Dara', 'Eka'];
const ENEMY_NAMES = ['Fajar', 'Gana', 'Hara', 'Ira', 'Jaka'];
const ALLY_WEAPONS = ['rajawali', 'rajawali', 'kancil', 'badak'];
const ENEMY_WEAPONS = ['rajawali', 'rajawali', 'rajawali', 'kancil', 'badak'];

export function createBots(scene, world, state, combat, player, random, hooks) {
  const raycaster = new THREE.Raycaster();
  raycaster.far = 80;
  const dir = new THREE.Vector3();
  const toEnemy = new THREE.Vector3();
  const chest = new THREE.Vector3();

  const allyMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), roughness: 0.6, metalness: 0.1 });
  const enemyMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.teal), roughness: 0.6, metalness: 0.1 });
  const darkMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.hairline), roughness: 0.85 });
  const headMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.45, metalness: 0.1 });
  const torsoGeo = new THREE.BoxGeometry(0.52, 0.78, 0.3);
  const headGeo = new THREE.SphereGeometry(0.155, 16, 12);
  const gunGeo = new THREE.BoxGeometry(0.07, 0.09, 0.5);
  const legGeo = new THREE.BoxGeometry(0.16, 0.5, 0.18);

  // Pulsar capsule: rides on the carrier, lies where dropped, glows on a site.
  const pulsarMesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.22),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), emissive: new THREE.Color(PALETTE.accent), emissiveIntensity: 0.9, roughness: 0.3 }),
  );
  pulsarMesh.castShadow = true;
  scene.add(pulsarMesh);

  // Which side attacks this half — set by spawnRound, used for the
  // defender-only behaviours (rotate to a planted Pulsar, hold posts).
  let currentAttacker = 'arunika';

  const bots = [];
  for (let i = 0; i < 9; i += 1) {
    const isAllySlot = i < 4;
    const group = new THREE.Group();
    const torso = new THREE.Mesh(torsoGeo, isAllySlot ? allyMat : enemyMat);
    torso.position.y = 1.0;
    torso.userData.part = 'torso';
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.53;
    head.userData.part = 'head';
    const gun = new THREE.Mesh(gunGeo, darkMat);
    gun.position.set(0.2, 1.05, -0.3);
    const legL = new THREE.Mesh(legGeo, darkMat);
    legL.position.set(-0.13, 0.25, 0);
    const legR = new THREE.Mesh(legGeo, darkMat);
    legR.position.set(0.13, 0.25, 0);
    group.add(torso, head, gun, legL, legR);
    group.traverse((mesh) => { if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; } });
    scene.add(group);

    const bot = {
      id: `bot${i}`,
      name: isAllySlot ? ALLY_NAMES[i] : ENEMY_NAMES[i - 4],
      side: 'arunika',
      body: {
        position: new THREE.Vector3(0, 0, 20), velocity: new THREE.Vector3(),
        yaw: 0, pitch: 0, eye: 1.6, onGround: true, crouching: false, height: 1.72,
      },
      mover: null,
      group, torsoMesh: torso, headMesh: head,
      eye: new THREE.Vector3(), muzzle: new THREE.Vector3(),
      weaponId: isAllySlot ? ALLY_WEAPONS[i] : ENEMY_WEAPONS[i - 4],
      spread: 0.016, health: 100, alive: true, fall: 0,
      botState: 'plan', waypoints: [], waypointIndex: 0, holdNode: -1,
      visibleEnemy: null, lastSeen: new THREE.Vector3(), lastSeenAt: -99,
      reactAt: 0, burstLeft: 0, burstPause: 0, cooldown: 0, sightTimer: i * 0.05,
      strafeDir: 1, strafeTimer: 0, isCarrier: false, actionProgress: 0, beepAt: 0,
      reaction: 0.5, baseSpread: 0.016, hearNode: -1,
    };
    bot.mover = createMover(world.colliders, bot.body, BOT_TUNING.moveSpeed);
    torso.userData.bot = bot;
    head.userData.bot = bot;
    bots.push(bot);
  }

  function faceToward(bot, x, z) {
    const dx = x - bot.body.position.x;
    const dz = z - bot.body.position.z;
    if (dx * dx + dz * dz < 0.0001) return;
    bot.body.yaw = Math.atan2(-dx, -dz);
  }

  function pathTo(bot, goalNode) {
    const from = nearestNode(bot.body.position.x, bot.body.position.z);
    const path = findPath(from, goalNode);
    bot.waypoints = path.map((node) => NODES[node]);
    bot.waypointIndex = 0;
  }

  function pickPlan(randomFn) {
    const roll = randomFn();
    if (roll < 0.3) return 'rushA';
    if (roll < 0.6) return 'rushB';
    if (roll < 0.85) return 'split';
    return 'mid';
  }

  function assignRoutes(attackers, plan) {
    const routes = [];
    if (plan === 'rushA') routes.push('rushA', 'rushA', 'rushA', 'rushA');
    else if (plan === 'rushB') routes.push('rushB', 'rushB', 'rushB', 'rushB');
    else if (plan === 'split') routes.push('splitA', 'splitA', 'splitB', 'midA');
    else routes.push('midA', 'midB', 'splitA', 'splitB');
    attackers.forEach((bot, index) => {
      const route = ATTACK_ROUTES[routes[index % routes.length]];
      const start = nearestNode(bot.body.position.x, bot.body.position.z);
      const head = findPath(start, route.path[0]).map((node) => NODES[node]);
      bot.waypoints = head.concat(route.path.slice(1).map((node) => NODES[node]));
      bot.waypointIndex = 0;
      bot.holdNode = route.path[route.path.length - 1];
      bot.botState = 'move';
    });
  }

  function assignPosts(defenders) {
    const posts = [...DEFENCE_POSTS.A, ...DEFENCE_POSTS.B, ...DEFENCE_POSTS.MID];
    defenders.forEach((bot, index) => {
      bot.holdNode = posts[index % posts.length];
      pathTo(bot, bot.holdNode);
      bot.botState = 'move';
    });
  }

  function spawnRound(playerSide, attackerSide) {
    currentAttacker = attackerSide;
    const defenderSide = attackerSide === 'arunika' ? 'meridian' : 'arunika';
    const attackers = [];
    const defenders = [];
    bots.forEach((bot, index) => {
      const ally = index < 4;
      bot.side = ally ? playerSide : (playerSide === 'arunika' ? 'meridian' : 'arunika');
      bot.torsoMesh.material = bot.side === 'arunika' ? allyMat : enemyMat;
      bot.alive = true;
      bot.health = 100;
      bot.fall = 0;
      bot.group.rotation.set(0, 0, 0);
      bot.visibleEnemy = null;
      bot.lastSeenAt = -99;
      bot.actionProgress = 0;
      bot.isCarrier = false;
      bot.reaction = BOT_TUNING.reactionMin + random() * (BOT_TUNING.reactionMax - BOT_TUNING.reactionMin);
      bot.baseSpread = BOT_TUNING.spreadMin + random() * (BOT_TUNING.spreadMax - BOT_TUNING.spreadMin);
      const spawnList = bot.side === 'arunika' ? world.spawns.arunika : world.spawns.meridian;
      const spot = spawnList[index % spawnList.length];
      bot.body.position.set(spot[0], 0, spot[1]);
      bot.body.velocity.set(0, 0, 0);
      bot.body.yaw = bot.side === 'arunika' ? 0 : Math.PI;
      bot.body.crouching = false;
      bot.body.height = 1.72;
      if (bot.side === attackerSide) attackers.push(bot);
      else defenders.push(bot);
    });
    // The carrier walks with the biggest group: the first attacker bot.
    attackers[0].isCarrier = true;
    state.pulsar.state = 'carried';
    state.pulsar.carrier = attackers[0].id;
    state.pulsar.site = null;
    state.pulsar.progress = 0;
    assignRoutes(attackers, pickPlan(random));
    assignPosts(defenders);
  }

  function canSee(bot, targetPos, targetCrouching) {
    const dx = targetPos.x - bot.eye.x;
    const dy = (targetPos.y + (targetCrouching ? 0.9 : 1.15)) - bot.eye.y;
    const dz = targetPos.z - bot.eye.z;
    const distance = Math.hypot(dx, dy, dz);
    if (distance > BOT_TUNING.sightRange) return false;
    toEnemy.set(dx / distance, dy / distance, dz / distance);
    const forwardX = -Math.sin(bot.body.yaw);
    const forwardZ = -Math.cos(bot.body.yaw);
    const cosAngle = (dx * forwardX + dz * forwardZ) / distance;
    if (cosAngle < Math.cos((BOT_TUNING.sightHalfAngle * Math.PI) / 180)) return false;
    raycaster.set(bot.eye, toEnemy);
    const hits = raycaster.intersectObjects(world.shootables, false);
    return !hits[0] || hits[0].distance > distance - 0.3;
  }

  function scan(bot) {
    bot.visibleEnemy = null;
    // Enemy bots first, then the player (only if the player is on the other side).
    for (const other of bots) {
      if (!other.alive || other.side === bot.side) continue;
      chest.copy(other.body.position);
      if (canSee(bot, chest, other.body.crouching)) {
        bot.visibleEnemy = { kind: 'bot', bot: other, x: other.body.position.x, y: other.body.position.y, z: other.body.position.z };
        break;
      }
    }
    if (!bot.visibleEnemy && player.state.health > 0 && playerSideOf(bot) !== state.playerSide) {
      chest.copy(player.state.position);
      if (canSee(bot, chest, player.state.crouching)) {
        bot.visibleEnemy = { kind: 'player', x: player.state.position.x, y: player.state.position.y, z: player.state.position.z };
      }
    }
    if (bot.visibleEnemy) {
      bot.lastSeen.set(bot.visibleEnemy.x, bot.visibleEnemy.y, bot.visibleEnemy.z);
      bot.lastSeenAt = state.elapsed;
    }
  }

  function playerSideOf(bot) {
    return bot.side;
  }

  function hear(bot) {
    for (let i = state.events.length - 1; i >= 0; i -= 1) {
      const event = state.events[i];
      if (state.elapsed - event.at > 0.6) continue;
      const dx = event.x - bot.body.position.x;
      const dz = event.z - bot.body.position.z;
      if (dx * dx + dz * dz > event.radius * event.radius) continue;
      if (event.kind === 'shot' || event.kind === 'plant') {
        faceToward(bot, event.x, event.z);
        if (bot.botState === 'hold' && event.kind === 'plant' && bot.side !== currentAttacker) {
          bot.hearNode = nearestNode(event.x, event.z);
          bot.botState = 'rotate';
          pathTo(bot, bot.hearNode);
        }
      }
      return;
    }
  }

  function moveAlongWaypoints(bot, dt, speedScale) {
    if (bot.waypointIndex >= bot.waypoints.length) return true;
    const target = bot.waypoints[bot.waypointIndex];
    const dx = target[0] - bot.body.position.x;
    const dz = target[1] - bot.body.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.9) {
      bot.waypointIndex += 1;
      return bot.waypointIndex >= bot.waypoints.length;
    }
    const wishX = (dx / distance) * speedScale;
    const wishZ = (dz / distance) * speedScale;
    bot.mover.step(dt, wishX, wishZ, false, false);
    faceToward(bot, target[0], target[1]);
    return false;
  }

  function fireAt(bot, dt) {
    const def = WEAPONS[bot.weaponId];
    bot.cooldown = Math.max(0, bot.cooldown - dt);
    if (state.elapsed < bot.reactAt || bot.cooldown > 0) return;
    if (bot.burstLeft <= 0) {
      bot.burstPause -= dt;
      if (bot.burstPause <= 0) {
        bot.burstLeft = BOT_TUNING.burstMin + Math.floor(random() * (BOT_TUNING.burstMax - BOT_TUNING.burstMin + 1));
        bot.burstPause = BOT_TUNING.burstPauseMin + random() * (BOT_TUNING.burstPauseMax - BOT_TUNING.burstPauseMin);
      }
      return;
    }
    const target = bot.visibleEnemy || { x: bot.lastSeen.x, y: bot.lastSeen.y, z: bot.lastSeen.z };
    dir.set(target.x - bot.eye.x, (target.y + 1.15) - bot.eye.y, target.z - bot.eye.z).normalize();
    const result = combat.shoot(bot.eye, dir, bot.weaponId, bot.spread, { side: bot.side, name: bot.name, isPlayer: false, weaponId: bot.weaponId, bot }, random);
    bot.cooldown = def.fireGap;
    bot.burstLeft -= 1;
    if (hooks && hooks.onShoot) hooks.onShoot(bot, result);
  }

  function stepBot(bot, dt, tickIndex) {
    if (!bot.alive) {
      bot.fall = Math.min(1, bot.fall + dt / 0.4);
      bot.group.rotation.x = -bot.fall * 1.45;
      bot.group.position.y = -bot.fall * 0.08;
      return;
    }
    bot.eye.set(bot.body.position.x, bot.body.position.y + 1.5, bot.body.position.z);
    const forwardX = -Math.sin(bot.body.yaw);
    const forwardZ = -Math.cos(bot.body.yaw);
    bot.muzzle.set(bot.eye.x + forwardX * 0.6, bot.eye.y - 0.08, bot.eye.z + forwardZ * 0.6);

    bot.sightTimer -= dt;
    if (bot.sightTimer <= 0 && tickIndex % 3 === (bots.indexOf(bot) % 3)) {
      bot.sightTimer = BOT_TUNING.sightEvery;
      const hadEnemy = !!bot.visibleEnemy;
      scan(bot);
      if (bot.visibleEnemy && !hadEnemy) bot.reactAt = state.elapsed + bot.reaction;
    }
    hear(bot);

    const enemyGone = !bot.visibleEnemy && state.elapsed - bot.lastSeenAt > BOT_TUNING.memorySeconds;
    const outnumbered = bots.filter((b) => b.alive && b.side === bot.side).length
      < bots.filter((b) => b.alive && b.side !== bot.side).length + (player.state.health > 0 && state.playerSide !== bot.side ? 1 : 0);

    if (bot.health < 25 && outnumbered && bot.botState !== 'retreat' && bot.botState !== 'defuse') {
      bot.botState = 'retreat';
      const spawnNode = bot.side === 'arunika' ? 0 : 23;
      pathTo(bot, spawnNode);
    }

    switch (bot.botState) {
      case 'plan':
        bot.botState = 'move';
        break;
      case 'move': {
        bot.spread = bot.baseSpread * 2;
        const arrived = moveAlongWaypoints(bot, dt, 1);
        if (bot.visibleEnemy) bot.botState = 'engage';
        else if (arrived) {
          if (bot.isCarrier && state.pulsar.carrier === bot.id && state.pulsar.state === 'carried') {
            bot.botState = 'plant';
            bot.actionProgress = 0;
          } else {
            bot.botState = 'hold';
          }
        }
        break;
      }
      case 'engage': {
        bot.spread = bot.baseSpread;
        if (bot.visibleEnemy) {
          faceToward(bot, bot.visibleEnemy.x, bot.visibleEnemy.z);
          bot.strafeTimer -= dt;
          if (bot.strafeTimer <= 0) { bot.strafeDir *= -1; bot.strafeTimer = 0.8; }
          const strafeX = forwardZ * bot.strafeDir * 0.4;
          const strafeZ = -forwardX * bot.strafeDir * 0.4;
          bot.mover.step(dt, strafeX, strafeZ, false, false);
          fireAt(bot, dt);
        } else if (enemyGone) {
          bot.botState = 'hold';
          pathTo(bot, bot.holdNode >= 0 ? bot.holdNode : nearestNode(bot.body.position.x, bot.body.position.z));
        }
        break;
      }
      case 'hold': {
        bot.spread = bot.baseSpread * 0.7;
        if (bot.visibleEnemy) { bot.botState = 'engage'; break; }
        // The carrier plants when the site has been quiet for 3 seconds.
        if (bot.isCarrier && state.pulsar.carrier === bot.id && state.pulsar.state === 'carried'
          && state.elapsed - bot.lastSeenAt > 3 && (bot.holdNode === 7 || bot.holdNode === 20)) {
          bot.botState = 'plant';
          bot.actionProgress = 0;
          break;
        }
        // Defenders rotate to a planted Pulsar.
        if (state.pulsar.state === 'planted' && bot.side !== currentAttacker) {
          const siteNode = state.pulsar.site === 'A' ? 7 : 20;
          bot.botState = 'rotate';
          pathTo(bot, siteNode);
          break;
        }
        // Not at the post yet (e.g. after losing an enemy mid-route): walk there.
        if (bot.holdNode >= 0) {
          const post = NODES[bot.holdNode];
          const dx = post[0] - bot.body.position.x;
          const dz = post[1] - bot.body.position.z;
          if (dx * dx + dz * dz > 4) {
            if (bot.waypointIndex >= bot.waypoints.length) pathTo(bot, bot.holdNode);
            moveAlongWaypoints(bot, dt, 0.9);
            break;
          }
        }
        bot.mover.step(dt, 0, 0, false, true);
        break;
      }
      case 'rotate': {
        bot.spread = bot.baseSpread * 2;
        const arrived = moveAlongWaypoints(bot, dt, 1);
        if (bot.visibleEnemy) { bot.botState = 'engage'; break; }
        if (arrived) {
          if (state.pulsar.state === 'planted') { bot.botState = 'defuse'; bot.actionProgress = 0; }
          else { bot.botState = 'hold'; }
        }
        break;
      }
      case 'plant': {
        if (bot.visibleEnemy || state.pulsar.carrier !== bot.id) { bot.botState = 'hold'; break; }
        bot.actionProgress += dt;
        if (state.elapsed - bot.beepAt > 0.5) {
          bot.beepAt = state.elapsed;
          emitSound(state, bot.body.position.x, bot.body.position.z, 20, 'plant');
        }
        if (bot.actionProgress >= 4) {
          const site = bot.body.position.x < 0 ? 'A' : 'B';
          state.pulsar.state = 'planted';
          state.pulsar.site = site;
          state.pulsar.x = SITE_CENTERS[site][0];
          state.pulsar.z = SITE_CENTERS[site][1];
          state.pulsar.explodeIn = 35;
          state.pulsar.progress = 0;
          bot.isCarrier = false;
          bot.botState = 'hold';
        }
        break;
      }
      case 'defuse': {
        if (state.pulsar.state !== 'planted') { bot.botState = 'hold'; break; }
        if (bot.visibleEnemy) { bot.botState = 'engage'; break; }
        bot.actionProgress += dt;
        if (state.elapsed - bot.beepAt > 0.4) {
          bot.beepAt = state.elapsed;
          emitSound(state, bot.body.position.x, bot.body.position.z, 20, 'defuse');
        }
        if (bot.actionProgress >= 5) {
          state.pulsar.state = 'defused';
          bot.botState = 'hold';
        }
        break;
      }
      case 'retreat': {
        bot.spread = bot.baseSpread * 2;
        const arrived = moveAlongWaypoints(bot, dt, 1);
        if (bot.visibleEnemy) { bot.botState = 'engage'; break; }
        if (arrived) bot.botState = 'hold';
        break;
      }
      default:
        bot.botState = 'move';
    }

    bot.group.position.copy(bot.body.position);
    bot.group.rotation.y = bot.body.yaw;
    bot.group.rotation.x = 0;
  }

  let tick = 0;
  function step(dt) {
    tick += 1;
    for (const bot of bots) stepBot(bot, dt, tick);
    // Pulsar mesh follows its carrier / drop / plant spot.
    const pulsar = state.pulsar;
    if (pulsar.state === 'carried' && pulsar.carrier !== 'player') {
      const carrier = bots.find((b) => b.id === pulsar.carrier);
      if (carrier && carrier.alive) {
        pulsarMesh.visible = true;
        pulsarMesh.position.set(carrier.body.position.x, carrier.body.position.y + 1.1, carrier.body.position.z);
      } else pulsarMesh.visible = false;
    } else if (pulsar.state === 'dropped') {
      pulsarMesh.visible = true;
      pulsarMesh.position.set(pulsar.x, 0.3, pulsar.z);
    } else if (pulsar.state === 'planted') {
      pulsarMesh.visible = true;
      pulsarMesh.position.set(pulsar.x, 0.4, pulsar.z);
      pulsarMesh.rotation.y += dt * 2;
    } else {
      pulsarMesh.visible = false;
    }
  }

  return {
    list: bots,
    step,
    spawnRound,
    aliveCount(side) {
      return bots.filter((b) => b.alive && b.side === side).length;
    },
  };
}
