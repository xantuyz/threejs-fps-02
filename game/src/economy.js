// Economy: credits (¢), prices and round rewards. One place owns every number:
// win +¢3.000, loss +¢1.900 (+¢500 per consecutive loss, capped +¢1.500),
// kill / plant / defuse +¢300, wallet cap ¢9.000. Loadout survives death —
// only spent grenades and ammo are gone. Armor (v2): Rompi Arunika ¢650 gives
// 50 armor points that absorb half of every hit until gone; it is bought like
// any other item and survives across rounds until the match ends. Buy logic
// only; the DOM lives in hud.js.
import { WEAPONS, GRENADE } from './weapons.js';

const WIN_REWARD = 3000;
const LOSS_REWARD = 1900;
const LOSS_BONUS_PER_STREAK = 500;
const LOSS_BONUS_CAP = 1500;
const ACTION_REWARD = 300;
const WALLET_CAP = 9000;
const REFILL_PRICE = 200;
export const ARMOR_PRICE = 650;
export const ARMOR_POINTS = 50;

export function createEconomy(state, weapon, player) {
  function canAfford(price) {
    return state.money >= price;
  }

  function buy(itemId) {
    if (itemId === 'armor') {
      if (!player || player.state.armor >= ARMOR_POINTS || !canAfford(ARMOR_PRICE)) return false;
      state.money -= ARMOR_PRICE;
      player.state.armor = ARMOR_POINTS;
      return true;
    }
    if (itemId === 'grenade') {
      if (weapon.state.grenades >= GRENADE.max || !canAfford(GRENADE.price)) return false;
      state.money -= GRENADE.price;
      weapon.state.grenades += 1;
      return true;
    }
    if (itemId === 'refill') {
      if (!canAfford(REFILL_PRICE)) return false;
      state.money -= REFILL_PRICE;
      for (const id of Object.keys(weapon.ammo)) {
        weapon.ammo[id].reserve = WEAPONS[id].reserve;
      }
      return true;
    }
    const def = WEAPONS[itemId];
    if (!def || weapon.state.owned[itemId] || !canAfford(def.price)) return false;
    state.money -= def.price;
    weapon.buy(itemId);
    return true;
  }

  function awardRound(winnerSide) {
    const playerWon = winnerSide === state.playerSide;
    if (playerWon) {
      state.money = Math.min(WALLET_CAP, state.money + WIN_REWARD);
      state.lossStreak = 0;
    } else {
      const bonus = Math.min(LOSS_BONUS_CAP, state.lossStreak * LOSS_BONUS_PER_STREAK);
      state.money = Math.min(WALLET_CAP, state.money + LOSS_REWARD + bonus);
      state.lossStreak += 1;
    }
  }

  function awardAction() {
    state.money = Math.min(WALLET_CAP, state.money + ACTION_REWARD);
  }

  return {
    buy, awardRound, awardAction, canAfford,
    prices() {
      return {
        kancil: WEAPONS.kancil.price,
        badak: WEAPONS.badak.price,
        rajawali: WEAPONS.rajawali.price,
        grenade: GRENADE.price,
        refill: REFILL_PRICE,
        armor: ARMOR_PRICE,
      };
    },
  };
}
