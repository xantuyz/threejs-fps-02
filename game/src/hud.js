// The DOM HUD: health, ammo, timer, score, money, kill feed, crosshair, buy
// menu, overlays. It never touches the simulation; main.js pushes numbers in
// and reads the play / buy callbacks out. Every setter caches its last value
// so the DOM is only written when something actually changed.
const COPY = {
  start: {
    title: 'ARUNIKA PROTOCOL',
    copy: 'Lima lawan lima. Dua titik. Satu muatan. Plant the Pulsar at Site A or B — or eliminate the Meridian guard.',
    action: 'Click to play',
  },
  paused: {
    title: 'ARUNIKA PROTOCOL',
    copy: 'Paused. Click to resume.',
    action: 'Click to resume',
  },
  end: {
    title: 'Match over',
    copy: 'The match is decided.',
    action: 'Play again',
  },
};

export function createHud() {
  const overlay = document.getElementById('overlay');
  const title = document.getElementById('overlay-title');
  const copy = document.getElementById('overlay-copy');
  const play = document.getElementById('play');
  const ammo = document.getElementById('ammo');
  const ammoMag = document.getElementById('ammo-mag');
  const ammoReserve = document.getElementById('ammo-reserve');
  const weaponName = document.getElementById('weapon-name');
  const healthValue = document.getElementById('health-value');
  const healthFill = document.getElementById('health-fill');
  const healthBox = document.getElementById('health');
  const timerValue = document.getElementById('timer-value');
  const scoreValue = document.getElementById('score-value');
  const roundValue = document.getElementById('round-value');
  const moneyValue = document.getElementById('money-value');
  const killFeed = document.getElementById('killfeed');
  const crosshair = document.getElementById('crosshair');
  const hitmarker = document.getElementById('hitmarker');
  const pulsarStatus = document.getElementById('pulsar-status');
  const banner = document.getElementById('round-banner');
  const progress = document.getElementById('progress');
  const progressLabel = document.getElementById('progress-label');
  const progressFill = document.getElementById('progress-fill');
  const damageFlash = document.getElementById('damage-flash');
  const buyMenu = document.getElementById('buy-menu');
  const buyMoney = document.getElementById('buy-money');
  const buyItems = document.getElementById('buy-items');
  let hitTimer = 0;
  let lastMag = -1;
  let lastReserve = -1;
  let lastWeapon = '';
  let lastHealth = -1;
  let lastTimer = '';
  let lastScore = '';
  let lastMoney = '';
  let lastPulsar = '';
  let lastFeed = '';
  let lastCrosshair = -1;
  let buyHandler = null;

  buyItems.addEventListener('click', (event) => {
    const button = event.target.closest('[data-buy]');
    if (button && buyHandler) buyHandler(button.dataset.buy);
  });

  return {
    setAmmo(mag, reserve, name) {
      if (mag === lastMag && reserve === lastReserve && name === lastWeapon) return;
      lastMag = mag;
      lastReserve = reserve;
      lastWeapon = name;
      ammoMag.textContent = String(mag);
      ammoReserve.textContent = `/ ${reserve}`;
      weaponName.textContent = name;
      ammo.classList.toggle('empty', mag === 0);
    },
    setHealth(hp) {
      const value = Math.max(0, Math.round(hp));
      if (value === lastHealth) return;
      lastHealth = value;
      healthValue.textContent = String(value);
      healthFill.style.width = `${value}%`;
      healthBox.classList.toggle('low', value <= 30);
    },
    setTimer(text, danger) {
      if (text === lastTimer) return;
      lastTimer = text;
      timerValue.textContent = text;
      timerValue.classList.toggle('danger', !!danger);
    },
    setScore(arunika, meridian, round) {
      const text = `ARUNIKA ${arunika} — ${meridian} MERIDIAN`;
      if (text === lastScore) return;
      lastScore = text;
      scoreValue.textContent = text;
      roundValue.textContent = `RONDE ${round}/15`;
    },
    setMoney(text) {
      if (text === lastMoney) return;
      lastMoney = text;
      moneyValue.textContent = text;
      buyMoney.textContent = text;
    },
    setKillFeed(items) {
      const text = items.map((item) => item.text).join('\n');
      if (text === lastFeed) return;
      lastFeed = text;
      killFeed.innerHTML = items.map((item) => `<div class="${item.headshot ? 'headshot' : ''}">${item.text}</div>`).join('');
    },
    setCrosshair(spread) {
      const gap = Math.round(3 + spread * 900);
      if (gap === lastCrosshair) return;
      lastCrosshair = gap;
      crosshair.style.setProperty('--gap', `${gap}px`);
    },
    setPulsar(text) {
      if (text === lastPulsar) return;
      lastPulsar = text;
      pulsarStatus.textContent = text;
      pulsarStatus.hidden = text === '';
    },
    setProgress(label, fraction) {
      progress.hidden = false;
      progressLabel.textContent = label;
      progressFill.style.width = `${Math.round(fraction * 100)}%`;
    },
    hideProgress() {
      progress.hidden = true;
    },
    hitMarker(killed, holdMs = 90) {
      hitmarker.classList.add('on');
      hitmarker.classList.toggle('kill', killed);
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => hitmarker.classList.remove('on', 'kill'), holdMs);
    },
    damageFlash() {
      damageFlash.classList.add('on');
      setTimeout(() => damageFlash.classList.remove('on'), 140);
    },
    roundBanner(text) {
      banner.textContent = text;
      banner.hidden = text === '';
    },
    showBuyMenu(items, moneyText) {
      buyMenu.hidden = false;
      buyMoney.textContent = moneyText;
      buyItems.innerHTML = items.map((item) => (
        `<button type="button" data-buy="${item.id}" ${item.disabled ? 'disabled' : ''} class="buy-item">
          <span class="buy-key">${item.key}</span>
          <span class="buy-name">${item.name}</span>
          <span class="buy-price">${item.price}</span>
        </button>`
      )).join('');
    },
    hideBuyMenu() {
      buyMenu.hidden = true;
    },
    showOverlay(mode, score) {
      const text = COPY[mode];
      title.textContent = text.title;
      copy.textContent = mode === 'end' ? `${text.copy} ${score}` : text.copy;
      play.textContent = text.action;
      overlay.hidden = false;
      play.focus();
    },
    hideOverlay() {
      overlay.hidden = true;
    },
    onPlay(handler) {
      play.addEventListener('click', handler);
    },
    onBuy(handler) {
      buyHandler = handler;
    },
  };
}
