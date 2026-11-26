import { PALETTE as C, VALLEYS, clamp } from './config.js';
import { nextTarget } from './world.js';
import { actionCue, objectiveText } from './missions.js';

function text(ctx, content, x, y, size = 12, color = C.cream, align = 'left', family = 'Trebuchet MS, sans-serif') {
  ctx.font = `${size}px ${family}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(content, x, y);
}

function box(ctx, x, y, width, height, fill = '#14262de8', stroke = '#aa8c625e', radius = 7) {
  ctx.beginPath(); ctx.roundRect(x, y, width, height, radius);
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}

function dial(ctx, x, y, value, max, label, unit) {
  const radius = 33;
  ctx.beginPath(); ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
  ctx.fillStyle = '#0d1e26'; ctx.fill(); ctx.strokeStyle = '#b79665'; ctx.lineWidth = 1.5; ctx.stroke();
  for (let i = 0; i < 21; i++) {
    const angle = Math.PI * 0.73 + i / 20 * Math.PI * 1.54;
    const outer = radius - 3, inner = outer - (i % 5 === 0 ? 7 : 3);
    ctx.strokeStyle = i > 16 ? '#e29b71' : '#a8b4a2'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
    ctx.lineTo(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer); ctx.stroke();
  }
  const angle = Math.PI * 0.73 + clamp(value / max, 0, 1) * Math.PI * 1.54;
  ctx.strokeStyle = '#ffd28a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(angle) * 23, y + Math.sin(angle) * 23); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fillStyle = '#ffe0a0'; ctx.fill();
  text(ctx, unit, x, y + 19, 8, '#c5bd9e', 'center');
  text(ctx, label, x + 52, y - 14, 10, '#aaa98e');
  text(ctx, String(Math.max(0, Math.round(value))).padStart(3, '0'), x + 50, y + 17, 31, '#ffe8b7');
}

function compass(ctx, plane) {
  const x = 479, width = 279, center = x + width / 2;
  const heading = ((plane.heading * 180 / Math.PI) % 360 + 360) % 360;
  text(ctx, 'HEADING', center, 626, 10, '#aaa98e', 'center');
  ctx.save(); ctx.beginPath(); ctx.rect(x, 633, width, 35); ctx.clip();
  for (let offset = -100; offset <= 100; offset += 10) {
    const mark = Math.floor(heading / 10) * 10 + offset;
    const px = center + (mark - heading) * 3.1;
    const normalized = (mark + 720) % 360;
    const label = ({ 0: 'N', 90: 'E', 180: 'S', 270: 'W' })[normalized];
    ctx.strokeStyle = label ? '#ffe0a1' : '#a4aea0'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px, 654); ctx.lineTo(px, label ? 644 : 649); ctx.stroke();
    if (label || normalized % 30 === 0) text(ctx, label || String(normalized).padStart(3, '0'), px, 642, label ? 12 : 9, '#c8c8af', 'center');
  }
  ctx.restore();
  ctx.fillStyle = '#ffd18a'; ctx.beginPath(); ctx.moveTo(center - 4, 659); ctx.lineTo(center + 4, 659); ctx.lineTo(center, 653); ctx.fill();
  text(ctx, `${String(Math.round(heading) % 360).padStart(3, '0')}°`, center, 684, 20, '#ffe5b0', 'center');
}

export function renderHud(ctx, flight, options = {}) {
  const { plane, mission, world } = flight;
  ctx.save();
  box(ctx, 22, 20, 340, 59);
  text(ctx, '✦', 39, 59, 31, '#ffd08a');
  text(ctx, 'L A N T E R N W I N G', 81, 48, 20, '#ffe8bd', 'left', 'Georgia, serif');
  text(ctx, 'VALLEY POST   /   THE LAST LIGHT TAKES FLIGHT', 82, 66, 8, '#b9b7a0');
  const valley = VALLEYS[flight.valley];
  text(ctx, valley.name.toUpperCase(), 31, 114, 20, '#ffe3b4', 'left', 'Georgia, serif');
  text(ctx, valley.subtitle, 32, 134, 11, '#e0c3a4');
  text(ctx, `VALLEY ${String(flight.valley + 1).padStart(2, '0')} / 07`, 33, 152, 9, '#c5bb9d');

  box(ctx, 838, 20, 420, 81);
  text(ctx, `0${flight.missionIndex + 1}  /  ${mission.name.toUpperCase()}`, 856, 43, 11, '#e2b87c');
  text(ctx, objectiveText(flight), 856, 65, 12, '#ffe8b7');
  const minutes = Math.floor(flight.time / 60), seconds = Math.floor(flight.time % 60);
  text(ctx, `FLIGHT ${minutes}:${String(seconds).padStart(2, '0')}   ·   SCORE ${String(flight.score).padStart(4, '0')}`, 856, 85, 10, '#bcbda6');

  const target = nextTarget(flight);
  const distance = Math.round(Math.max(0, target.z - plane.z));
  box(ctx, 477, 23, 323, 46, '#1a2b30d9');
  const targetLabel = target.type === 'boss' ? 'STORM KEEPER' : target.type.toUpperCase();
  text(ctx, `${targetLabel}  /  ${distance} m AHEAD`, 638, 43, 11, '#ffdc9b', 'center');
  const arrow = clamp((target.x - plane.x) / 10, -110, 110);
  ctx.strokeStyle = '#a8b8a0'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(535, 55); ctx.lineTo(742, 55); ctx.stroke();
  ctx.fillStyle = '#f3cc86'; ctx.beginPath(); ctx.moveTo(638 + arrow, 59); ctx.lineTo(634 + arrow, 52); ctx.lineTo(642 + arrow, 52); ctx.fill();

  if (flight.messageUntil > flight.time) {
    box(ctx, 324, 164, 632, 30, '#172b31bf', null, 4);
    text(ctx, flight.message, 640, 184, 12, '#ffe3ac', 'center');
  }

  // A restrained bank indicator ties the visible airframe to its turn discipline.
  ctx.strokeStyle = '#ffe1a56e'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(640, 476, 79, Math.PI * 1.13, Math.PI * 1.87); ctx.stroke();
  const bankAngle = Math.PI * 1.5 + plane.bank * 0.48;
  ctx.fillStyle = '#ffe1a5';
  ctx.beginPath(); ctx.arc(640 + Math.cos(bankAngle) * 79, 476 + Math.sin(bankAngle) * 79, 2, 0, Math.PI * 2); ctx.fill();

  const cue = actionCue(flight);
  if (cue.kind !== 'drop' && !plane.rolling) {
    box(ctx, 498, 563, 284, 25, '#263c38e8', '#e9be78a0', 3);
    text(ctx, cue.text, 640, 580, 11, '#ffe5aa', 'center');
  }
  let warning = '';
  if (plane.speed < 32 && !plane.rolling) warning = 'LOW AIRSPEED  ·  ADD THROTTLE';
  if (plane.turnStress > 1.3 && !plane.rolling) warning = 'TURN LIFT LOSS  ·  EASE THE BANK';
  if (plane.fuel < 18) warning = 'LOW FUEL  ·  FIND THE RUNWAY';
  if (plane.altitude < 35 && !plane.rolling && target.type !== 'runway') warning = 'LOW ALTITUDE  ·  W / ↑ TO CLIMB';
  if (plane.rolling) warning = plane.touchdown.hard ? 'HARD TOUCHDOWN  ·  WING DAMAGED' : 'TOUCHDOWN  ·  FOLLOW THE LIGHTS';
  if (plane.crashed) warning = 'MAYDAY  ·  THE LANTERN WING IS DOWN';
  if (warning) {
    box(ctx, 421, 110, 438, 30, '#382e2be8', '#e2a16f88', 3);
    text(ctx, warning, 640, 130, 12, '#ffd294', 'center');
  }

  box(ctx, 22, 602, 1236, 100, '#13272ef5', '#c49b6275', 7);
  ctx.strokeStyle = '#aa936259'; ctx.lineWidth = 1;
  for (const x of [248, 461, 779, 1006]) { ctx.beginPath(); ctx.moveTo(x, 617); ctx.lineTo(x, 687); ctx.stroke(); }
  dial(ctx, 79, 650, plane.altitude, 650, 'ALTITUDE', 'm');
  dial(ctx, 295, 650, plane.speed, 160, 'AIRSPEED', 'm/s');
  compass(ctx, plane);
  text(ctx, 'FUEL', 800, 626, 10, '#aaa98e');
  text(ctx, `${Math.ceil(plane.fuel)} / ${plane.maxFuel}`, 985, 626, 11, '#ddcda6', 'right');
  box(ctx, 801, 637, 185, 9, '#0b1d25', null, 2);
  ctx.fillStyle = plane.fuel < 18 ? '#eb9b74' : '#cabd80'; ctx.fillRect(802, 638, 183 * clamp(plane.fuel / plane.maxFuel, 0, 1), 7);
  text(ctx, 'THROTTLE', 800, 670, 9, '#aaa98e');
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i / 16 < plane.throttle ? '#e3bf7c' : '#34464a'; ctx.fillRect(865 + i * 7.5, 660, 5, 12);
  }
  text(ctx, 'LANTERNS', 1027, 627, 10, '#aaa98e');
  text(ctx, String(plane.cargo).padStart(2, '0'), 1229, 632, 26, '#ffda94', 'right');
  text(ctx, 'WING', 1027, 655, 9, '#aaa98e');
  text(ctx, `${Math.round(plane.damage)}% DAMAGE`, 1229, 655, 10, plane.damage > 50 ? '#ffa788' : '#c0c8ac', 'right');
  ctx.fillStyle = '#30454a'; ctx.fillRect(1028, 663, 200, 5);
  ctx.fillStyle = plane.damage > 50 ? '#df9477' : '#a2bb97'; ctx.fillRect(1028, 663, 200 * clamp(1 - plane.damage / 100, 0, 1), 5);
  text(ctx, `RINGS ${world.rings.filter(r => r.collected).length}/24   ·   POST +${flight.earned}`, 1027, 688, 9, '#c4b793');
  text(ctx, options.shot ? 'VALLEY POST  /  SEEDED FLIGHT RECORDER' : 'WASD / ARROWS  FLY     E / Q  THROTTLE     SPACE  LANTERN / BOOST     ESC  PAUSE     M  SOUND', 640, 716, 9, '#b0ae97', 'center');
  ctx.restore();
}
