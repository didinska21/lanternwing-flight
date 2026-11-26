import { STEP, MISSIONS, VALLEYS, UPGRADES, TUNING, clamp, upgradeCost } from './config.js';
import { seedNumber } from './random.js';
import { createFlight, stepFlight, autopilot } from './missions.js';
import { renderWorld } from './render.js';
import { renderHud } from './hud.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { shotRequest, playShot } from './shots.js';

const canvas = document.querySelector('#flight');
const ctx = canvas.getContext('2d', { alpha: false });
const interfaceRoot = document.querySelector('#interface');
const query = new URLSearchParams(window.location.search);
const seed = seedNumber(query.get('seed') ?? '7');
const requestedShot = shotRequest(window.location.search);
const audio = createAudio();
const STORAGE = 'lanternwing-courier-v1';

function freshProfile() {
  return { lanterns: TUNING.startingWallet, damage: 0, upgrades: {}, completed: [], best: 0 };
}

function loadProfile() {
  const profile = freshProfile();
  if (requestedShot) return profile;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE));
    if (!saved || typeof saved !== 'object') return profile;
    if (Number.isFinite(saved.lanterns)) profile.lanterns = clamp(Math.floor(saved.lanterns), 0, 1000000);
    if (Number.isFinite(saved.damage)) profile.damage = clamp(saved.damage, 0, 85);
    if (Number.isFinite(saved.best)) profile.best = Math.max(0, Math.floor(saved.best));
    for (const upgrade of UPGRADES) {
      profile.upgrades[upgrade.id] = clamp(Math.floor(Number(saved.upgrades?.[upgrade.id]) || 0), 0, upgrade.max);
    }
    profile.completed = MISSIONS.filter(m => Array.isArray(saved.completed) && saved.completed.includes(m.id)).map(m => m.id);
  } catch { /* A private or file browser may decline local saves. The game still plays. */ }
  return profile;
}

const profile = loadProfile();
let screen = requestedShot ? 'shot' : 'title';
let missionIndex = 0;
let flight = requestedShot ? playShot(requestedShot, seed) : createFlight(seed, 0);
let previousTime = null;
let accumulator = 0;

function saveProfile() {
  if (requestedShot) return;
  try { localStorage.setItem(STORAGE, JSON.stringify(profile)); } catch { /* Session progress remains available in memory. */ }
}

function element(tag, className = '', content = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content) node.textContent = content;
  return node;
}

function button(label, handler, primary = false, disabled = false) {
  const node = element('button', primary ? 'primary' : '', label);
  node.type = 'button'; node.disabled = disabled;
  node.addEventListener('click', () => { audio.unlock(); handler(); });
  return node;
}

function panel(wide = false) {
  interfaceRoot.replaceChildren();
  const node = element('section', 'screen' + (wide ? ' wide' : ''));
  interfaceRoot.append(node);
  accumulator = 0;
  return node;
}

function controlsNote() {
  return element('p', 'help', 'W / ↑ climb · S / ↓ descend · A D / ← → turn\nE / Shift more throttle · Q / Ctrl less throttle\nSpace release lantern / ring boost · Esc pause · M sound\nOptional: hold the mouse button in the flight view to steer.');
}

function title() {
  screen = 'title';
  const node = panel();
  node.append(element('p', 'eyebrow', 'An airmail adventure at the edge of night'));
  node.append(element('h1', '', 'LANTERNWING'));
  node.append(element('p', 'subtitle', 'The last light takes flight.\nCarry a little warmth down a very long river.'));
  const actions = element('div', 'actions');
  actions.append(button('TAKE A FLIGHT', missionSelect, true), button('VISIT THE HANGAR', hangar));
  node.append(actions, controlsNote());
  const stats = element('div', 'stats');
  for (const [count, label] of [['7', 'VALLEYS'], ['24', 'SKY-RINGS'], ['3', 'STORM KEEPERS'], ['12', 'UPGRADES']]) {
    const stat = element('div'); stat.append(element('strong', '', count), document.createTextNode(label)); stats.append(stat);
  }
  node.append(stats);
}

function missionSelect() {
  screen = 'missions';
  const node = panel(true);
  node.append(element('p', 'eyebrow', 'Valley post · Flight dispatch'));
  node.append(element('h2', '', 'Choose a light to carry'));
  node.append(element('p', 'small', 'All five routes are open. Finish the objective and land at the final valley runway to earn the route bonus.'));
  const grid = element('div', 'mission-grid');
  MISSIONS.forEach((mission, index) => {
    const card = element('article', 'card');
    card.append(element('div', 'mission-number', String(index + 1).padStart(2, '0')),
      element('h3', '', mission.name), element('p', '', mission.briefing),
      element('span', '', `${VALLEYS[mission.valleys[0]].name} · ${mission.reward} lantern bonus`));
    card.append(button(profile.completed.includes(mission.id) ? 'FLY AGAIN  ✓' : 'ACCEPT FLIGHT', () => startFlight(index), index === missionIndex));
    grid.append(card);
  });
  const actions = element('div', 'actions'); actions.append(button('HANGAR', hangar), button('BACK TO TITLE', title));
  node.append(grid, actions, element('p', 'small', 'Tip: aim for 42–68 m/s on final approach. Above 88 m/s, a hard turn can pull the lift out from under you.'));
}

function repairCost() { return Math.ceil(profile.damage * 0.45); }

function hangar() {
  screen = 'hangar';
  const node = panel(true);
  const heading = element('div', 'topline');
  heading.append(element('h2', '', 'The lamplighter’s hangar'), element('p', 'small wallet', `${profile.lanterns} LANTERNS  ·  ${Math.round(profile.damage)}% WING DAMAGE`));
  node.append(element('p', 'eyebrow', 'Hand-stitched canvas. A little more courage.'), heading);
  const grid = element('div', 'grid');
  for (const upgrade of UPGRADES) {
    const level = profile.upgrades[upgrade.id] || 0;
    const cost = upgradeCost(upgrade, level);
    const card = element('article', 'card');
    card.append(element('h3', '', upgrade.name), element('p', '', upgrade.description));
    card.append(button(level >= upgrade.max ? `FITTED  ${level}/${upgrade.max}` : `${cost} LANTERNS  ·  ${level}/${upgrade.max}`, () => {
      if (profile.lanterns < cost || level >= upgrade.max) return;
      profile.lanterns -= cost;
      profile.upgrades[upgrade.id] = level + 1;
      saveProfile(); audio.chime('ring'); hangar();
    }, false, profile.lanterns < cost || level >= upgrade.max));
    grid.append(card);
  }
  const actions = element('div', 'actions');
  actions.append(button('CHOOSE A MISSION', missionSelect, true), button(`REPAIR WING  ·  ${repairCost()} LANTERNS`, () => {
    const cost = repairCost();
    if (profile.lanterns < cost) return;
    profile.lanterns -= cost; profile.damage = 0; saveProfile(); hangar();
  }, false, profile.damage === 0 || profile.lanterns < repairCost()), button('TITLE', title));
  node.append(grid, actions, element('p', 'small', 'Upgrades, earnings, and wing wear save on this browser when local storage is available. Fuel and lantern cradles are replenished before every flight.'));
}

function flightButtons() {
  interfaceRoot.replaceChildren();
  const group = element('div', 'actions');
  group.style.cssText = 'position:absolute;right:24px;top:111px;margin:0;pointer-events:auto;gap:8px';
  const pauseButton = button('Ⅱ PAUSE', pause);
  const soundButton = button(audio.muted ? 'SOUND OFF' : 'M SOUND', () => { audio.toggle(); flightButtons(); });
  for (const node of [pauseButton, soundButton]) node.style.cssText = 'font-size:9px;padding:7px 9px;background:#172b31c9';
  group.append(pauseButton, soundButton); interfaceRoot.append(group);
}

function startFlight(index = missionIndex) {
  missionIndex = index;
  flight = createFlight(seed, index, profile.upgrades, profile.damage);
  screen = 'flying'; input.clear(); accumulator = 0;
  flightButtons(); canvas.focus();
}

function pause() {
  if (screen === 'pause') { resume(); return; }
  if (screen !== 'flying' || flight.status !== 'flying') return;
  screen = 'pause'; input.clear();
  const node = panel();
  node.append(element('p', 'eyebrow', 'The valley can wait a moment'), element('h2', '', 'Wings at rest'),
    element('p', 'subtitle', `${flight.mission.name} · ${VALLEYS[flight.valley].name}`), controlsNote());
  const actions = element('div', 'actions');
  actions.append(button('RESUME FLIGHT', resume, true), button('RESTART ROUTE', () => startFlight()), button('RETURN TO DISPATCH', missionSelect));
  node.append(actions, element('p', 'small', 'Returning to dispatch abandons this flight’s unbanked earnings.'));
}

function resume() {
  if (screen !== 'pause') return;
  screen = 'flying'; accumulator = 0; input.clear(); flightButtons(); canvas.focus();
}

function results() {
  screen = 'results';
  let payment = 0;
  if (!flight.saved) {
    payment = flight.status === 'complete' ? flight.earned : Math.floor(flight.earned * 0.55);
    profile.lanterns += payment;
    profile.damage = Math.min(85, flight.plane.damage);
    profile.best = Math.max(profile.best, flight.score);
    if (flight.status === 'complete' && !profile.completed.includes(flight.mission.id)) profile.completed.push(flight.mission.id);
    flight.saved = true; flight.payment = payment; saveProfile();
  }
  const complete = flight.status === 'complete', crash = flight.status === 'crash';
  const node = panel();
  node.append(element('p', 'eyebrow', complete ? 'Valley post · A light safely carried' : crash ? 'Valley post · Search party dispatched' : 'Valley post · Wheels on the ground'));
  node.append(element('h2', '', complete ? 'Welcome home, courier.' : crash ? 'The light will fly again.' : 'Safe landing. Unfinished route.'));
  node.append(element('p', 'subtitle', complete ? `${flight.mission.name} complete. The valley is a little less dark.`
    : crash ? flight.plane.crashReason : 'The runway is safe, but the mission objective is still waiting.'));
  const detail = element('div', 'result-lines');
  const touchdown = flight.plane.touchdown;
  detail.append(element('div', '', `Objective ${flight.progress}/${flight.mission.goal} · Score ${flight.score} · +${flight.payment || 0} banked lanterns`));
  detail.append(element('div', '', `Wing damage ${Math.round(profile.damage)}% · Repairs ${repairCost()} lanterns · Wallet ${profile.lanterns}`));
  if (touchdown) detail.append(element('div', '', `${touchdown.hard ? 'Hard' : 'Gentle'} touchdown · ${touchdown.speed.toFixed(1)} m/s · ${touchdown.sink.toFixed(1)} m/s sink`));
  const actions = element('div', 'actions');
  actions.append(button('BACK TO HANGAR', hangar, true), button('FLY THIS ROUTE AGAIN', () => startFlight()), button('MISSION DISPATCH', missionSelect));
  node.append(detail, actions);
}

const input = createInput(canvas, command => {
  if (requestedShot) return;
  if (command === 'pause') pause();
  if (command === 'blur' && screen === 'flying') pause();
  if (command === 'mute') { audio.toggle(); if (screen === 'flying') flightButtons(); }
  if (command === 'retry' && (screen === 'results' || screen === 'pause')) startFlight();
}, () => { if (!requestedShot) audio.unlock(); });

function draw() {
  renderWorld(ctx, flight);
  if (['flying', 'pause', 'results', 'shot'].includes(screen)) renderHud(ctx, flight, { shot: !!requestedShot });
}

// Small read-only diagnostics make seeded recordings and offline checks inspectable.
window.lanternwing = Object.freeze({
  getState: () => ({ screen, seed, mission: flight.mission.id, status: flight.status, ticks: flight.ticks,
    time: flight.time, altitude: flight.plane.altitude, speed: flight.plane.speed, heading: flight.plane.heading,
    progress: flight.progress, damage: flight.plane.damage, fuel: flight.plane.fuel, cargo: flight.plane.cargo,
    shot: flight.shot || null, counts: { valleys: VALLEYS.length, rings: flight.world.rings.length,
      bosses: flight.world.bosses.length, missions: MISSIONS.length, upgrades: UPGRADES.length } }),
});

if (requestedShot) {
  draw();
  document.documentElement.dataset.ready = 'true';
  document.documentElement.dataset.shotReady = String(flight.shot.ready);
  document.documentElement.dataset.shotTick = String(flight.ticks);
} else {
  // Warm up the title flyover using the same controls as the recording pilot.
  for (let i = 0; i < 240; i++) stepFlight(flight, autopilot(flight), STEP);
  title(); draw();
  document.documentElement.dataset.ready = 'true';
  function frame(timestamp) {
    const elapsed = previousTime === null ? 0 : Math.min(0.1, (timestamp - previousTime) / 1000);
    previousTime = timestamp;
    accumulator = Math.min(accumulator + elapsed, 0.15);
    while (accumulator >= STEP) {
      if (screen === 'flying') {
        stepFlight(flight, input.read(), STEP);
        for (const event of flight.events.splice(0)) audio.chime(event.type);
        if (flight.status !== 'flying' && flight.resultTime > 1.65) results();
      } else if (screen === 'title') {
        stepFlight(flight, autopilot(flight), STEP);
        flight.events.length = 0;
        if (flight.status !== 'flying') flight = createFlight(seed, 0);
      }
      accumulator -= STEP;
    }
    draw(); audio.update(flight.plane, screen === 'flying');
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
