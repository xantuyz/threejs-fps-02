// Objective: the Pulsar (plant / defuse / pickup). The player plants by holding
// E for 4 s, standing still inside a site while carrying the Pulsar; defuses by
// holding E for 5 s within 2 m of a planted Pulsar. Moving cancels progress.
// A dropped Pulsar is picked up with G. Bot plant/defuse lives in bots.js;
// this module owns the player's side of the same rules.
import { SITES } from './world.js';
import { emitSound } from './state.js';

const PLANT_SECONDS = 4;
const DEFUSE_SECONDS = 5;
const PICKUP_RADIUS = 1.6;

export function createObjective(state, player, economy, hooks) {
  function siteAt(x, z) {
    for (const key of Object.keys(SITES)) {
      const site = SITES[key];
      if (x >= site.minX && x <= site.maxX && z >= site.minZ && z <= site.maxZ) return key;
    }
    return null;
  }

  function distanceToPulsar() {
    const dx = state.pulsar.x - player.state.position.x;
    const dz = state.pulsar.z - player.state.position.z;
    return Math.hypot(dx, dz);
  }

  function step(dt, keys) {
    const pulsar = state.pulsar;
    if (state.phase !== 'live') return;
    const moving = Math.hypot(player.state.velocity.x, player.state.velocity.z) > 0.6;
    const holdingE = keys.has('KeyE');

    // Plant: carrier, inside a site, standing still, holding E.
    if (pulsar.state === 'carried' && pulsar.carrier === 'player' && holdingE && !moving) {
      const site = siteAt(player.state.position.x, player.state.position.z);
      if (site) {
        pulsar.progress += dt;
        pulsar.site = site;
        if (state.elapsed - (pulsar.beepAt || 0) > 0.5) {
          pulsar.beepAt = state.elapsed;
          emitSound(state, player.state.position.x, player.state.position.z, 20, 'plant', state.playerSide);
          if (hooks && hooks.onPlantBeep) hooks.onPlantBeep();
        }
        if (pulsar.progress >= PLANT_SECONDS) {
          pulsar.state = 'planted';
          pulsar.x = SITES[site].cx;
          pulsar.z = SITES[site].cz;
          pulsar.explodeIn = 35;
          pulsar.progress = 0;
          economy.awardAction();
          if (hooks && hooks.onPlanted) hooks.onPlanted(site);
        }
        return;
      }
    }
    // Defuse: planted, close, holding E, standing still.
    if (pulsar.state === 'planted' && holdingE && !moving && distanceToPulsar() < 2) {
      pulsar.progress += dt;
      if (state.elapsed - (pulsar.beepAt || 0) > 0.4) {
        pulsar.beepAt = state.elapsed;
        emitSound(state, player.state.position.x, player.state.position.z, 20, 'defuse', state.playerSide);
        if (hooks && hooks.onDefuseBeep) hooks.onDefuseBeep();
      }
      if (pulsar.progress >= DEFUSE_SECONDS) {
        pulsar.state = 'defused';
        pulsar.progress = 0;
        economy.awardAction();
        if (hooks && hooks.onDefused) hooks.onDefused();
      }
      return;
    }
    // Any other state resets the progress bar.
    if (pulsar.state === 'carried' || pulsar.state === 'planted') pulsar.progress = 0;
  }

  function tryPickup() {
    const pulsar = state.pulsar;
    if (pulsar.state !== 'dropped') return false;
    if (distanceToPulsar() > PICKUP_RADIUS) return false;
    pulsar.state = 'carried';
    pulsar.carrier = 'player';
    pulsar.progress = 0;
    return true;
  }

  return { step, tryPickup, siteAt };
}
