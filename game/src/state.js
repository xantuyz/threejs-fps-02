// Single state store: the one source of truth for the whole game. Rounds, bots,
// combat and the HUD read this object; only rounds.js writes `phase`, only
// economy.js writes `money`, and only combat.js writes health — through the small
// helpers below. No module keeps a second copy of score, timer or phase.
export const PHASES = {
  MENU: 'menu',
  BUY: 'buy',
  LIVE: 'live',
  ROUND_END: 'roundEnd',
  MATCH_END: 'matchEnd',
};

export const SIDES = { ARUNIKA: 'arunika', MERIDIAN: 'meridian' };
export const TEAM_NAMES = { arunika: 'ARUNIKA', meridian: 'MERIDIAN' };

export function createGameState() {
  return {
    phase: PHASES.MENU,
    paused: false,
    round: 1,
    score: { arunika: 0, meridian: 0 },
    roundTimeLeft: 100,
    buyTimeLeft: 15,
    roundEndLeft: 0,
    roundEndReason: '',
    roundWinner: '',
    money: 800,
    lossStreak: 0,
    kills: 0,
    deaths: 0,
    playerSide: SIDES.ARUNIKA,
    // Pulsar (the objective): carried by the player or a bot, dropped on the floor,
    // or planted at a site with a 35 s fuse.
    pulsar: { state: 'carried', carrier: 'player', x: 0, z: 0, site: null, progress: 0, explodeIn: 35 },
    killFeed: [],
    events: [], // sound events bots can hear: { x, z, radius, kind, at }
    elapsed: 0,
    matchWinner: '',
    mvp: '',
  };
}

// A sound event bots may react to. Radius in metres; kinds: 'shot', 'step',
// 'plant', 'defuse', 'blast'. Old events are pruned by bots.js each tick.
export function emitSound(state, x, z, radius, kind) {
  state.events.push({ x, z, radius, kind, at: state.elapsed });
  if (state.events.length > 24) state.events.splice(0, state.events.length - 24);
}

export function addKillFeed(state, text, headshot) {
  state.killFeed.unshift({ text, headshot, at: state.elapsed });
  if (state.killFeed.length > 3) state.killFeed.length = 3;
}

export function aliveCount(bots, side) {
  let count = 0;
  for (const bot of bots) if (bot.alive && bot.side === side) count += 1;
  return count;
}
