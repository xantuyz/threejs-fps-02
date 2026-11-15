// Round state machine — the ONLY writer of state.phase. MENU -> BUY (15 s) ->
// LIVE (100 s) -> ROUND_END (5 s) -> BUY ... -> MATCH_END at first-to-8 or
// round 15. Halftime after round 7 swaps sides (the player attacks first,
// then defends). Win by elimination, Pulsar explosion, defuse, or timeout.
import { PHASES } from './state.js';

export const BUY_SECONDS = 15;
export const LIVE_SECONDS = 100;
export const ROUND_END_SECONDS = 5;
export const WIN_ROUNDS = 8;
export const MAX_ROUNDS = 15;
export const HALFTIME_ROUND = 7;
export const PULSAR_FUSE = 35;

export function createRounds(state, bots, player, economy, hooks) {
  let attackerSide = 'arunika';

  function defenderSide() {
    return attackerSide === 'arunika' ? 'meridian' : 'arunika';
  }

  function resetPositions() {
    // The player's team never changes (Arunika); only the ROLE swaps at
    // halftime, so the player always spawns south and faces north.
    const spawn = state.playerSide === 'arunika' ? [0, 20] : [0, -20];
    player.state.position.set(spawn[0], 0, spawn[1]);
    player.state.velocity.set(0, 0, 0);
    player.state.yaw = state.playerSide === 'arunika' ? 0 : Math.PI;
    player.state.pitch = 0;
    player.state.health = 100;
  }

  function startRound() {
    state.buyTimeLeft = BUY_SECONDS;
    state.roundTimeLeft = LIVE_SECONDS;
    state.roundEndLeft = 0;
    state.roundWinner = '';
    state.roundEndReason = '';
    state.pulsar.state = 'carried';
    state.pulsar.carrier = null;
    state.pulsar.site = null;
    state.pulsar.progress = 0;
    state.pulsar.explodeIn = PULSAR_FUSE;
    resetPositions();
    bots.spawnRound(state.playerSide, attackerSide);
    state.phase = PHASES.BUY;
    if (hooks && hooks.onRoundStart) hooks.onRoundStart(state.round);
  }

  function startMatch() {
    state.round = 1;
    state.score.arunika = 0;
    state.score.meridian = 0;
    state.money = 800;
    state.lossStreak = 0;
    state.kills = 0;
    state.deaths = 0;
    state.matchWinner = '';
    attackerSide = 'arunika';
    state.playerSide = 'arunika';
    startRound();
  }

  function startLive() {
    if (state.phase !== PHASES.BUY) return;
    state.phase = PHASES.LIVE;
  }

  function matchOver() {
    return state.score.arunika >= WIN_ROUNDS || state.score.meridian >= WIN_ROUNDS || state.round >= MAX_ROUNDS;
  }

  function endRound(winner, reason) {
    if (state.phase !== PHASES.LIVE) return;
    state.phase = PHASES.ROUND_END;
    state.roundEndLeft = ROUND_END_SECONDS;
    state.roundWinner = winner;
    state.roundEndReason = reason;
    state.score[winner] += 1;
    economy.awardRound(winner);
    if (hooks && hooks.onRoundEnd) hooks.onRoundEnd(winner, reason);
  }

  function nextRound() {
    if (state.round === HALFTIME_ROUND) {
      // Roles swap: the other team attacks now. The player's TEAM stays the
      // same — in half 2 Arunika defends the sites it attacked in half 1.
      attackerSide = defenderSide();
    }
    state.round += 1;
    startRound();
  }

  function aliveOn(side) {
    let count = bots.aliveCount(side);
    if (state.playerSide === side && player.state.health > 0) count += 1;
    return count;
  }

  function step(dt) {
    if (state.phase === PHASES.BUY) {
      state.buyTimeLeft -= dt;
      if (state.buyTimeLeft <= 0) startLive();
      return;
    }
    if (state.phase === PHASES.LIVE) {
      state.roundTimeLeft -= dt;
      if (state.pulsar.state === 'planted') {
        state.pulsar.explodeIn -= dt;
        if (state.pulsar.explodeIn <= 0) { endRound(attackerSide, 'Ledakan'); return; }
        if (state.pulsar.state === 'defused') { endRound(defenderSide(), 'Dijinakkan'); return; }
      }
      if (state.pulsar.state === 'defused') { endRound(defenderSide(), 'Dijinakkan'); return; }
      if (aliveOn(defenderSide()) === 0) { endRound(attackerSide, 'Eliminasi'); return; }
      if (aliveOn(attackerSide) === 0 && state.pulsar.state !== 'planted') {
        endRound(defenderSide(), 'Eliminasi');
        return;
      }
      if (state.roundTimeLeft <= 0 && state.pulsar.state !== 'planted') {
        endRound(defenderSide(), 'Waktu habis');
      }
      return;
    }
    if (state.phase === PHASES.ROUND_END) {
      state.roundEndLeft -= dt;
      if (state.roundEndLeft > 0) return;
      if (matchOver()) {
        state.phase = PHASES.MATCH_END;
        state.matchWinner = state.score.arunika > state.score.meridian ? 'arunika' : 'meridian';
        if (hooks && hooks.onMatchEnd) hooks.onMatchEnd(state.matchWinner);
      } else {
        nextRound();
      }
    }
  }

  return {
    step, startMatch, startLive, startRound, endRound,
    attackerSide() { return attackerSide; },
    defenderSide,
  };
}
