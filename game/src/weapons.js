// Weapon catalogue as data, not if-chains: every number a judge or a tuner needs
// lives in WEAPONS. The view model is one small group of boxes whose barrel and
// colour change per weapon. Spread punishes moving, rewards crouching still and
// ADS; recoil kicks pitch up and recovers partly on its own.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const WEAPONS = {
  p9: {
    id: 'p9', name: 'Srigala P9', kind: 'pistol', price: 0, damage: 28, headMult: 4,
    fireGap: 0.15, mag: 12, reserve: 36, reloadTime: 1.4,
    spreadStill: 0.004, spreadMove: 0.03, crouchMult: 0.6, recoil: 0.006,
    falloffStart: 12, falloffEnd: 30, falloffMin: 18, speed: 5.4, auto: false,
    pellets: 1, ads: false, barrel: 0.2,
  },
  kancil: {
    id: 'kancil', name: 'Kancil-9', kind: 'smg', price: 1500, damage: 26, headMult: 4,
    fireGap: 0.08, mag: 32, reserve: 96, reloadTime: 2.0,
    spreadStill: 0.006, spreadMove: 0.034, crouchMult: 0.6, recoil: 0.007,
    falloffStart: 10, falloffEnd: 25, falloffMin: 14, speed: 5.4, auto: true,
    pellets: 1, ads: false, barrel: 0.3,
  },
  rajawali: {
    id: 'rajawali', name: 'Rajawali-77', kind: 'rifle', price: 2700, damage: 33, headMult: 4,
    fireGap: 0.1, mag: 30, reserve: 90, reloadTime: 2.2,
    spreadStill: 0.0022, spreadMove: 0.028, crouchMult: 0.55, recoil: 0.009,
    falloffStart: 15, falloffEnd: 40, falloffMin: 24, speed: 5.2, auto: true,
    pellets: 1, ads: true, barrel: 0.42,
  },
  badak: {
    id: 'badak', name: 'Badak-12', kind: 'shotgun', price: 1700, damage: 12, headMult: 2,
    fireGap: 0.85, mag: 6, reserve: 24, reloadTime: 2.8,
    spreadStill: 0.045, spreadMove: 0.055, crouchMult: 0.8, recoil: 0.03,
    falloffStart: 6, falloffEnd: 18, falloffMin: 3, speed: 5.0, auto: false,
    pellets: 8, ads: false, barrel: 0.36,
  },
};

export const GRENADE = { id: 'guntur', name: 'Granat Guntur', price: 300, max: 2 };
export const WEAPON_ORDER = ['p9', 'kancil', 'badak', 'rajawali'];
const MUZZLE_TIME = 0.06;

export function createWeapon(camera) {
  const grip = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.hairline), roughness: 0.7, metalness: 0.2 });
  const body = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.5, metalness: 0.35 });

  const model = new THREE.Group();
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.42), body);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.4), grip);
  barrel.position.set(0, 0.025, -0.38);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.08, 0.22), grip);
  stock.position.set(0, -0.02, 0.3);
  model.add(receiver, barrel, stock);
  model.position.set(0.24, -0.2, -0.42);
  camera.add(model);

  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  );
  flash.position.set(0.24, -0.18, -0.95);
  flash.visible = false;
  camera.add(flash);

  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 5);
  flashLight.position.set(0.24, -0.16, -0.6);
  camera.add(flashLight);

  const ammo = {};
  for (const id of WEAPON_ORDER) ammo[id] = { mag: WEAPONS[id].mag, reserve: WEAPONS[id].reserve };
  const state = {
    current: 'rajawali', cooldown: 0, reloadLeft: 0, flash: 0, kick: 0,
    heat: 0, ads: false, grenades: 0, owned: { p9: true, rajawali: true },
  };

  function def() {
    return WEAPONS[state.current];
  }

  function step(dt) {
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.flash = Math.max(0, state.flash - dt);
    state.kick += (0 - state.kick) * Math.min(1, dt * 14);
    // Spray heat decays when the trigger rests; it punishes holding fire.
    state.heat = Math.max(0, state.heat - dt * 0.02);
    model.position.z = -0.42 + state.kick;
    model.position.x = state.ads ? 0 : 0.24;
    model.position.y = state.ads ? -0.155 : -0.2;
    model.rotation.x = state.kick * 2.2;
    flash.visible = state.flash > 0;
    flash.rotation.z = state.flash * 30;
    flashLight.intensity = state.flash > 0 ? 18 : 0;
    if (state.reloadLeft > 0) {
      const d = def();
      state.reloadLeft = Math.max(0, state.reloadLeft - dt);
      model.rotation.x = -0.55 * Math.min(1, (d.reloadTime - state.reloadLeft) * 2);
      if (state.reloadLeft === 0) {
        const slot = ammo[state.current];
        const take = Math.min(d.mag - slot.mag, slot.reserve);
        slot.mag += take;
        slot.reserve -= take;
      }
    }
  }

  return {
    state,
    ammo,
    def,
    step,
    ready() {
      const slot = ammo[state.current];
      return slot.mag > 0 && state.cooldown === 0 && state.reloadLeft === 0;
    },
    pullTrigger() {
      state.cooldown = def().fireGap;
      state.flash = MUZZLE_TIME;
      state.kick = 0.055;
      state.heat = Math.min(0.012, state.heat + 0.0015);
    },
    takeRound() {
      const slot = ammo[state.current];
      if (slot.mag <= 0) return false;
      slot.mag -= 1;
      return true;
    },
    reload() {
      const d = def();
      const slot = ammo[state.current];
      if (state.reloadLeft > 0 || slot.mag === d.mag || slot.reserve === 0) return;
      state.reloadLeft = d.reloadTime;
    },
    refill() {
      for (const id of WEAPON_ORDER) {
        ammo[id].mag = WEAPONS[id].mag;
        ammo[id].reserve = WEAPONS[id].reserve;
      }
      state.cooldown = 0;
      state.reloadLeft = 0;
      state.flash = 0;
      state.kick = 0;
      state.heat = 0;
    },
    // spread = base x stance x move x air + heat. Standing still is most
    // accurate; crouching still tighter still; ADS halves it (rifle only).
    spread(speed, crouched, airborne) {
      const d = def();
      let value = d.spreadStill + Math.min(1, speed / d.speed) * d.spreadMove;
      if (crouched) value *= d.crouchMult;
      if (state.ads && d.ads) value *= 0.5;
      if (airborne) value *= 1.5;
      return value + state.heat;
    },
    switchTo(id) {
      if (!state.owned[id] || id === state.current) return false;
      state.current = id;
      state.reloadLeft = 0;
      state.cooldown = 0;
      state.ads = false;
      barrel.scale.z = def().barrel / 0.4;
      return true;
    },
    buy(id) {
      state.owned[id] = true;
      return this.switchTo(id);
    },
    setAds(on) {
      state.ads = on && def().ads && state.reloadLeft === 0;
    },
  };
}
