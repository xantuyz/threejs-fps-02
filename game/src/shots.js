// Deterministic screenshot modes: ?shot=buy|mid|plant|win&seed=1. Each shot sets
// up the same simulation a player could reach — positions, health, money,
// score, timer, phase — then main.js settles a few fixed steps and renders
// twice. Nothing here stages a pose the game cannot produce.
import { PHASES } from './state.js';

export function applyShot(name, api) {
  const { state, player, bots, weapon, hud, rounds } = api;
  state.paused = false;
  player.state.health = 100;
  weapon.refill();
  weapon.state.owned = { p9: true, kancil: true, badak: true, rajawali: true };
  weapon.switchTo('rajawali');

  if (name === 'buy') {
    // Cover: the buy menu between rounds, spawn behind it, two allies nearby.
    state.phase = PHASES.BUY;
    state.round = 3;
    state.score.arunika = 2;
    state.score.meridian = 1;
    state.money = 3800;
    state.buyTimeLeft = 12;
    api.placePlayer(0, 20, 0, 0);
    api.placeBot(0, -3, 18, 0.3);
    api.placeBot(1, 3, 18, -0.3);
    api.placeBot(4, 0, -12, Math.PI);
    hud.showBuyMenu(api.buyItems(), '¢3.800');
    return;
  }

  if (name === 'mid') {
    // Mid duel: ADS rifle, an enemy at the far end of the 40 m sightline,
    // tracer and muzzle flash from a shot just fired, one ally on the left.
    rounds.startMatch();
    state.phase = PHASES.LIVE;
    state.round = 5;
    state.score.arunika = 3;
    state.score.meridian = 2;
    state.money = 3100;
    state.roundTimeLeft = 83;
    player.state.health = 78;
    weapon.ammo.rajawali.mag = 24;
    weapon.ammo.rajawali.reserve = 90;
    weapon.setAds(true);
    api.placePlayer(0, 12, 0, 0);
    api.placeBot(4, 0, -12, Math.PI);
    api.placeBot(5, 4, -10, Math.PI);
    api.placeBot(0, -4, 8, 0);
    api.settle(10);
    api.aimAtBot(4);
    api.fireOnce();
    api.settle(1);
    state.killFeed.unshift({ text: 'Kamu ▸ Gana [Rajawali-77]', headshot: false, at: 0 });
    return;
  }

  if (name === 'plant') {
    // Planting the Pulsar at Site B, an ally holding the door, a grenade blast
    // outside, timer and score visible.
    rounds.startMatch();
    state.phase = PHASES.LIVE;
    state.round = 10;
    state.score.arunika = 5;
    state.score.meridian = 4;
    state.money = 2400;
    state.roundTimeLeft = 41;
    state.pulsar.state = 'carried';
    state.pulsar.carrier = 'player';
    state.pulsar.progress = 2.5;
    api.placePlayer(20, -15, 0.6, -0.1);
    api.placeBot(0, 17, -11, 0.4);
    api.placeBot(4, 24, -6, Math.PI);
    api.blastAt(18, 0.5, -4);
    hud.setProgress('MENANAM PULSAR…', 2.5 / 4);
    return;
  }

  if (name === 'win') {
    // Round end: Arunika wins by detonation, score 8-5, reward paid, the
    // kill feed full, Site A smoking in the distance.
    rounds.startMatch();
    state.phase = PHASES.ROUND_END;
    state.round = 13;
    state.score.arunika = 8;
    state.score.meridian = 5;
    state.money = 5400;
    state.roundWinner = 'arunika';
    state.roundEndReason = 'Ledakan';
    state.roundEndLeft = 4;
    api.placePlayer(0, 6, 0, 0);
    api.placeBot(4, -18, -12, 0.5, false, 0);
    api.placeBot(0, -3, 2, 0);
    api.blastAt(-20, 1, -15);
    state.killFeed = [
      { text: 'Kamu ▸ Hara [Rajawali-77] ✕ HEADSHOT', headshot: true, at: 0 },
      { text: 'Bara ▸ Fajar [Kancil-9]', headshot: false, at: 0 },
      { text: 'Kamu ▸ Gana [Rajawali-77]', headshot: false, at: 0 },
    ];
    hud.roundBanner('RONDE DIMENANGKAN — Arunika (Ledakan)  +¢3.000');
    return;
  }

  // Fallback: the plain start frame.
  state.phase = PHASES.BUY;
  api.placePlayer(0, 20, 0, 0);
}
