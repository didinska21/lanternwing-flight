import { WIDTH, HEIGHT, PALETTE as C, TUNING, VALLEYS, VALLEY_LENGTH, clamp, lerp } from './config.js';
import { hashNoise } from './random.js';
import { project, nextTarget } from './world.js';

function polygon(ctx, points, fill, stroke, width = 1) {
  if (points.some(p => !p)) return;
  ctx.beginPath();
  points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}

function ellipse(ctx, x, y, rx, ry, fill) {
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  ctx.fillStyle = fill; ctx.fill();
}

function glow(ctx, x, y, radius, color = '255,198,111', strength = 0.4) {
  if (radius <= 0 || !Number.isFinite(radius)) return;
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(${color},${strength})`);
  gradient.addColorStop(0.4, `rgba(${color},${strength * 0.24})`);
  gradient.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function sky(ctx, flight) {
  const night = flight.mission.night;
  const gradient = ctx.createLinearGradient(0, 0, 0, 440);
  gradient.addColorStop(0, night > 0.6 ? '#172838' : '#494450');
  gradient.addColorStop(0.37, night > 0.6 ? '#494655' : '#a2737e');
  gradient.addColorStop(0.7, night > 0.6 ? '#986a74' : '#e8a17e');
  gradient.addColorStop(1, '#efbc8c');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const sunX = 322 - Math.sin(flight.plane.heading) * 90;
  glow(ctx, sunX, 180, 230, '255,198,130', 0.24);
  ellipse(ctx, sunX, 180, 47, 47, night > 0.6 ? '#dec1a2' : '#ffd5a1');
  ctx.fillStyle = '#c6887d66';
  for (let i = 0; i < 5; i++) ctx.fillRect(sunX - 52, 168 + i * 12, 104, 2 + i);
  if (night > 0.35) {
    for (let i = 0; i < 65; i++) {
      const x = hashNoise(i, flight.seed) * WIDTH;
      const y = hashNoise(i + 100, flight.seed) * 160;
      const pulse = 0.35 + Math.sin(flight.time * 0.8 + i) * 0.15;
      ctx.fillStyle = `rgba(255,231,187,${pulse})`;
      ctx.fillRect(x, y, i % 8 === 0 ? 2 : 1, 1.5);
    }
  }
  // Long translucent cloud streaks keep the dusk sky from feeling empty.
  for (let i = 0; i < 9; i++) {
    const x = (i * 193 + Math.sin(flight.time * 0.012 + i) * 80) % 1500 - 100;
    ellipse(ctx, x, 85 + (i % 4) * 30, 120 + (i % 3) * 35, 3 + i % 3, '#f3bb9e23');
  }
  for (let layer = 0; layer < 4; layer++) {
    const points = [{ x: 0, y: 405 }];
    for (let x = -80; x <= WIDTH + 80; x += 40) {
      const noise = hashNoise(Math.floor((x + 80) / 40), flight.seed + layer * 31);
      const height = 24 + noise * (55 + layer * 17);
      points.push({ x, y: 247 + layer * 25 - height });
    }
    points.push({ x: WIDTH + 80, y: 500 }, { x: 0, y: 500 });
    polygon(ctx, points, ['#8c737b', '#736973', '#5b6268', '#46565b'][layer]);
  }
  glow(ctx, sunX, 235, 245, '255,188,129', 0.13);
}

function terrain(ctx, flight) {
  const { world, plane } = flight;
  const base = Math.floor(plane.z / 75) * 75;
  for (let far = 5200; far > -180; far -= 75) {
    const z = base + far, nearZ = z - 75;
    const river = world.riverX(z), nearRiver = world.riverX(nearZ);
    const p = (x, zz, h = 0) => project(plane, x, zz, h);
    const a = p(river - 2300, z), b = p(river + 2300, z);
    const c = p(nearRiver + 2300, nearZ), d = p(nearRiver - 2300, nearZ);
    if (!a || !b || !c || !d) continue;
    const fog = clamp(far / 6500, 0, 0.75);
    const noise = hashNoise(Math.floor(z / 75), world.seed);
    ctx.globalAlpha = 1;
    polygon(ctx, [a, b, c, d], noise > 0.6 ? '#66705a' : '#5e705b');
    // Sloping ochre riverbanks and strips of field on both sides.
    const width = 85 + Math.sin(z / 900) * 16;
    const nearWidth = 85 + Math.sin(nearZ / 900) * 16;
    polygon(ctx, [p(river - width - 17, z), p(river + width + 17, z),
      p(nearRiver + nearWidth + 17, nearZ), p(nearRiver - nearWidth - 17, nearZ)], '#af996e');
    polygon(ctx, [p(river - width, z, 1), p(river + width, z, 1),
      p(nearRiver + nearWidth, nearZ, 1), p(nearRiver - nearWidth, nearZ, 1)], noise > 0.5 ? '#5b8487' : '#587d81');
    const streak = river + Math.sin(z / 55) * width * 0.25;
    polygon(ctx, [p(streak - 5, z, 2), p(streak + 12, z, 2), p(nearRiver + 7, nearZ, 2), p(nearRiver - 4, nearZ, 2)], '#d4c1994b');
    if (Math.floor(z / 75) % 4 === 0) {
      for (const side of [-1, 1]) {
        polygon(ctx, [p(river + side * 350, z), p(river + side * 660, z),
          p(nearRiver + side * 610, nearZ), p(nearRiver + side * 325, nearZ)], '#aa95692c');
      }
    }
    // The delivery road threads the villages, separate from the water.
    const side = Math.floor(Math.max(0, z) / VALLEY_LENGTH) % 2 ? 1 : -1;
    polygon(ctx, [p(river + side * 233, z), p(river + side * 239, z),
      p(nearRiver + side * 239, nearZ), p(nearRiver + side * 233, nearZ)], '#b4a079');
    if (fog > 0.1) {
      ctx.globalAlpha = fog * 0.55;
      polygon(ctx, [a, b, c, d], '#bd9c88');
      ctx.globalAlpha = 1;
    }
  }
  // High shoulders form a valley around the traversable river floor.
  for (const side of [-1, 1]) {
    for (let z = base + 4900; z > base + 700; z -= 210) {
      const height = (210 + hashNoise(Math.floor(z / 210), world.seed + side) * 220) * VALLEYS[flight.valley].ridge;
      const center = world.riverX(z);
      polygon(ctx, [project(plane, center + side * 850, z), project(plane, center + side * 1450, z + 60, height),
        project(plane, center + side * 2400, z + 210), project(plane, center + side * 1100, z - 210)], '#435b57');
      polygon(ctx, [project(plane, center + side * 850, z), project(plane, center + side * 1450, z + 60, height),
        project(plane, center + side * 1600, z + 180, height * 0.7)], '#647265');
    }
  }
}

function tree(ctx, flight, item) {
  const p = project(flight.plane, item.x, item.z);
  if (!p || p.x < -70 || p.x > WIDTH + 70 || p.y < 205 || p.y > HEIGHT + 100) return;
  const scale = p.scale;
  const h = item.height * scale, w = item.width * scale;
  if (h < 2) return;
  ellipse(ctx, p.x + w * 0.7, p.y + 1, w * 1.2, w * 0.3, '#172f303a');
  ctx.fillStyle = '#624f3e'; ctx.fillRect(p.x - scale, p.y - h * 0.2, scale * 2, h * 0.2);
  for (let tier = 0; tier < 3; tier++) {
    const y = p.y - h * (0.28 + tier * 0.22);
    polygon(ctx, [{ x: p.x - w * (1 - tier * 0.16), y }, { x: p.x, y: y - h * 0.55 },
      { x: p.x + w * (1 - tier * 0.16), y }], item.shade > 0.5 ? '#2c5149' : '#355c50');
    polygon(ctx, [{ x: p.x - w * (1 - tier * 0.16), y }, { x: p.x, y: y - h * 0.55 },
      { x: p.x - w * 0.12, y: y - h * 0.08 }], '#79916c50');
  }
}

function village(ctx, flight, item) {
  const { plane } = flight;
  const center = project(plane, item.x, item.z);
  if (!center || center.y > HEIGHT + 170) return;
  const radius = 80 * center.scale;
  ellipse(ctx, center.x, center.y, radius, radius * 0.26, '#a38b654d');
  for (const house of item.houses) {
    const ground = project(plane, item.x + house.x, item.z + house.z);
    const roof = project(plane, item.x + house.x, item.z + house.z, house.height);
    if (!ground || !roof) continue;
    const w = house.width * ground.scale;
    const h = ground.y - roof.y;
    ctx.fillStyle = '#b89b78'; ctx.fillRect(ground.x - w / 2, roof.y, w, h);
    ctx.fillStyle = '#826958'; ctx.fillRect(ground.x + w * 0.15, roof.y, w * 0.35, h);
    polygon(ctx, [{ x: ground.x - w * 0.65, y: roof.y }, { x: ground.x, y: roof.y - h * 0.48 },
      { x: ground.x + w * 0.65, y: roof.y }], house.roof ? '#724a43' : '#68574b', '#413f3b', Math.min(1, ground.scale));
    const lit = item.lit || house.warmth > 0.77;
    for (const side of [-1, 1]) {
      const wx = ground.x + side * w * 0.23, wy = roof.y + h * 0.5;
      if (lit) glow(ctx, wx, wy, Math.max(3, w * 0.7), '255,188,89', item.lit ? 0.55 : 0.2);
      ctx.fillStyle = lit ? '#ffd68a' : '#3d4c4c';
      ctx.fillRect(wx - w * 0.09, wy, w * 0.18, Math.max(1, h * 0.32));
    }
    if (item.lit) {
      for (let j = 0; j < 2; j++) {
        const lift = (flight.time * 6 + house.warmth * 100 + j * 29) % 90;
        const lantern = project(plane, item.x + house.x + Math.sin(house.warmth * 7) * lift * 0.2,
          item.z + house.z, house.height + lift);
        if (lantern) { glow(ctx, lantern.x, lantern.y, 7 * lantern.scale); ctx.fillStyle = '#ffca72'; ctx.fillRect(lantern.x, lantern.y, 2 * lantern.scale, 3 * lantern.scale); }
      }
    }
  }
  if (!item.delivered && (flight.mission.id === 'rescue' || flight.mission.id === 'night')
    && item.valley >= flight.mission.valleys[0] && item.valley <= flight.mission.valleys[1]) {
    const beacon = project(plane, item.x, item.z, 100);
    if (!beacon) return;
    const width = clamp(12 * beacon.scale, 6, 24);
    glow(ctx, beacon.x, center.y, radius * 1.5);
    ctx.strokeStyle = '#ffd08999'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(center.x, center.y); ctx.lineTo(beacon.x, beacon.y); ctx.stroke();
    polygon(ctx, [{ x: beacon.x, y: beacon.y - width }, { x: beacon.x + width, y: beacon.y },
      { x: beacon.x, y: beacon.y + width }, { x: beacon.x - width, y: beacon.y }], '#ffd58944', '#ffdc9b', 2);
  }
}

function ring(ctx, flight, item) {
  const p = project(flight.plane, item.x, item.z, item.altitude);
  if (!p || p.y < -100 || p.y > HEIGHT + 180) return;
  const age = flight.time - item.collectedAt;
  if (item.collected && age > 1.8) return;
  const r = item.radius * p.scale;
  if (r < 2 || r > 480) return;
  ctx.save();
  if (item.collected) ctx.globalAlpha = Math.max(0, 1 - age / 1.8);
  ctx.shadowColor = '#ffc66b'; ctx.shadowBlur = 16 + p.scale * 2;
  ctx.lineWidth = clamp(4 * p.scale, 2, 8);
  ctx.strokeStyle = '#ffd38a';
  ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.97, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.lineWidth = Math.max(1, p.scale * 1.2); ctx.strokeStyle = '#8d674a';
  ctx.beginPath(); ctx.arc(p.x, p.y, r + 5 * p.scale, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#fff0c7'; ctx.lineWidth = Math.max(1, p.scale * 0.8);
  ctx.beginPath(); ctx.arc(p.x, p.y, r - 3 * p.scale, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6;
    const x = p.x + Math.cos(angle) * r, y = p.y + Math.sin(angle) * r * 0.97;
    ellipse(ctx, x, y, clamp(p.scale * 2.4, 1, 5), clamp(p.scale * 2.4, 1, 5), '#fff2c8');
  }
  if (item.z > flight.plane.z + 50) {
    ctx.font = '11px Trebuchet MS, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe6b3';
    ctx.fillText(String(item.id + 1).padStart(2, '0'), p.x, p.y - r - 12);
  }
  if (item.collected) {
    ctx.strokeStyle = '#ffe8ac'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(p.x, p.y, r * (1 + age * 1.3), 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

function runway(ctx, flight, item) {
  const p = (x, z, altitude = 1) => project(flight.plane, x, z, altitude);
  const w = item.width / 2;
  // Clip the near end against the camera plane, keeping rollout geometry valid.
  const start = Math.max(item.start, flight.plane.z - 220);
  if (start >= item.end) return;
  polygon(ctx, [p(item.x - w - 25, item.end), p(item.x + w + 25, item.end),
    p(item.x + w + 25, start), p(item.x - w - 25, start)], '#a99a71');
  polygon(ctx, [p(item.x - w, item.end), p(item.x + w, item.end),
    p(item.x + w, start), p(item.x - w, start)], '#485454');
  for (let z = item.start; z < item.end; z += 38) {
    if (z < start) continue;
    polygon(ctx, [p(item.x - 2, z + 16), p(item.x + 2, z + 16), p(item.x + 2, z), p(item.x - 2, z)], '#e5cc9d');
    for (const side of [-1, 1]) {
      const light = p(item.x + side * (w - 3), z, 2);
      if (!light || light.y > HEIGHT + 50) continue;
      const size = clamp(light.scale * 2.2, 1, 6);
      glow(ctx, light.x, light.y, size * 5, '255,205,123', 0.55);
      ellipse(ctx, light.x, light.y, size, size * 0.6, '#fff0bc');
    }
  }
  for (let i = -3; i <= 3; i++) {
    if (i === 0) continue;
    polygon(ctx, [p(item.x + i * 11 - 3, item.start + 26), p(item.x + i * 11 + 3, item.start + 26),
      p(item.x + i * 11 + 3, item.start + 6), p(item.x + i * 11 - 3, item.start + 6)], '#e8dab2');
  }
  for (let i = 1; i < 6; i++) {
    const z = item.start - i * 50;
    const light = p(item.x, z, 3);
    if (!light || z < flight.plane.z - 100) continue;
    const width = 12 * light.scale;
    ctx.strokeStyle = '#ffd392'; ctx.lineWidth = clamp(2 * light.scale, 1, 4);
    ctx.beginPath(); ctx.moveTo(light.x - width, light.y + 6 * light.scale); ctx.lineTo(light.x, light.y);
    ctx.lineTo(light.x + width, light.y + 6 * light.scale); ctx.stroke();
    glow(ctx, light.x, light.y, width * 2);
  }
  const board = p(item.x + w + 42, item.start + 35, 15);
  if (board && board.scale > 0.45 && board.y < HEIGHT) {
    ctx.font = `${clamp(10 * board.scale, 9, 20)}px Trebuchet MS, sans-serif`;
    ctx.textAlign = 'left'; ctx.fillStyle = '#ffe1a1'; ctx.fillText('HOME  /  07', board.x, board.y);
  }
}

function pass(ctx, flight, item) {
  const p = (x, h) => project(flight.plane, item.x + x, item.z, h);
  const h = item.halfWidth;
  for (const side of [-1, 1]) {
    polygon(ctx, [p(side * h, 0), p(side * h, 265), p(side * (h + 100), 380),
      p(side * (h + 270), 320), p(side * (h + 500), 540), p(side * 1800, 0)], '#374d4d', '#687466', 1);
    polygon(ctx, [p(side * h, 0), p(side * h, 265), p(side * (h + 100), 380),
      p(side * (h + 130), 160)], '#7f8670');
    const top = p(side * h, item.ceiling), bottom = p(side * h, item.floor);
    if (top && bottom) {
      ctx.strokeStyle = '#ffd089'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(bottom.x, bottom.y); ctx.stroke();
      glow(ctx, top.x, top.y, 22 * top.scale);
    }
  }
  const left = p(-h, item.ceiling), right = p(h, item.ceiling);
  if (left && right) {
    ctx.setLineDash([8, 8]); ctx.strokeStyle = '#e6ca99aa'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(left.x, left.y); ctx.lineTo(right.x, right.y); ctx.stroke(); ctx.setLineDash([]);
  }
}

function cloud(ctx, flight, item) {
  const p = project(flight.plane, item.x, item.z, item.altitude);
  if (!p || p.x < -400 || p.x > WIDTH + 400 || p.y < -250 || p.y > HEIGHT) return;
  const r = Math.min(400, item.size * p.scale);
  for (let i = 0; i < 5; i++) ellipse(ctx, p.x + (i - 2) * r * 0.3, p.y + Math.sin(i * 2) * r * 0.07,
    r * (0.29 + i % 2 * 0.12), r * 0.11, item.shade > 0.5 ? '#e4c1ad44' : '#dcb0a637');
}

function lightning(ctx, from, to, seed, time, width = 3) {
  const points = [from];
  for (let i = 1; i < 9; i++) {
    const t = i / 9;
    points.push({ x: lerp(from.x, to.x, t) + (hashNoise(i + Math.floor(time * 9) * 11, seed) - 0.5) * 58,
      y: lerp(from.y, to.y, t) });
  }
  points.push(to);
  ctx.save(); ctx.lineJoin = 'bevel'; ctx.shadowColor = '#ffd99f'; ctx.shadowBlur = 20;
  for (const [color, thickness] of [['#f5b76a', width * 3], ['#fff4cf', width]]) {
    ctx.strokeStyle = color; ctx.lineWidth = thickness;
    ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
  }
  ctx.restore();
}

function boss(ctx, flight, item) {
  const p = project(flight.plane, item.x, item.z, item.altitude);
  if (!p || p.y > HEIGHT + 150) return;
  if (item.defeated && flight.time - item.hitAt > 3) return;
  const r = clamp(item.size * p.scale, 8, 340);
  const age = flight.time - item.hitAt;
  ctx.save();
  if (item.defeated) ctx.globalAlpha = Math.max(0, 1 - age / 3);
  glow(ctx, p.x, p.y, r * 2, '242,157,96', 0.17);
  for (let layer = 0; layer < 3; layer++) {
    for (let i = 0; i < 11; i++) {
      const angle = i / 11 * Math.PI * 2 + flight.time * (layer % 2 ? -0.17 : 0.14) + layer * 0.3;
      const radius = r * (0.5 + layer * 0.13);
      const x = p.x + Math.cos(angle) * radius;
      const y = p.y + Math.sin(angle) * radius * 0.48;
      ellipse(ctx, x, y, r * 0.43, r * 0.25, ['#514451', '#3c3947', '#5e4d56'][layer]);
      ctx.strokeStyle = '#d3926b55'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(x - 2, y - 5, r * 0.35, r * 0.17, -0.2, 3.2, 5.5); ctx.stroke();
    }
  }
  for (let i = 0; i < 5; i++) {
    const x = p.x + (i - 2) * r * 0.3;
    ctx.strokeStyle = '#a2766d88'; ctx.lineWidth = r * 0.05;
    ctx.beginPath(); ctx.moveTo(x, p.y + r * 0.1);
    ctx.bezierCurveTo(x + r * 0.4, p.y + r * 0.6, x - r * 0.2, p.y + r * 0.6, x + Math.sin(flight.time + i) * r * 0.2, p.y + r * 0.95);
    ctx.stroke();
  }
  glow(ctx, p.x, p.y, r * 0.7, '255,181,100', age < 0.25 ? 0.95 : 0.55);
  ellipse(ctx, p.x, p.y, r * 0.34, r * 0.22, '#201f2d');
  ellipse(ctx, p.x, p.y, r * 0.21, r * 0.15, '#edb974');
  ellipse(ctx, p.x + Math.sin(flight.time) * r * 0.045, p.y, r * 0.055, r * 0.12, '#4b3a3e');
  if (item.strike) {
    const ground = project(flight.plane, item.strike.x, item.strike.z, 1);
    const strikeAge = flight.time - item.strike.start;
    if (ground) {
      ellipse(ctx, ground.x, Math.min(850, ground.y), 55 * ground.scale, 12 * ground.scale, '#ffc46b38');
      if (strikeAge >= 1) lightning(ctx, { x: p.x - r * 0.2, y: p.y + r * 0.3 }, ground, flight.seed + item.id, flight.time, 3);
      else {
        ctx.strokeStyle = '#ffcc8490'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 7]);
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(ground.x, ground.y); ctx.stroke(); ctx.setLineDash([]);
      }
    }
  }
  // Electricity within the cloud is present while the keeper is charging.
  if (!item.defeated) {
    const arc = Math.floor(flight.time * 2.5 + item.phase) % 3;
    lightning(ctx, { x: p.x - r * 0.72, y: p.y - r * 0.1 },
      { x: p.x - r * 0.2 + arc * r * 0.18, y: p.y + r * 0.18 }, flight.seed, flight.time, 1.2);
  }
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffe2b2';
  ctx.font = '12px Trebuchet MS, sans-serif';
  ctx.fillText(item.name.toUpperCase(), p.x, p.y - r * 0.85 - 16);
  const bar = Math.min(150, r * 1.6);
  for (let i = 0; i < item.hp; i++) {
    ctx.fillStyle = i < item.health ? '#f5c780' : '#876c6355';
    ctx.fillRect(p.x - bar / 2 + i * bar / item.hp, p.y - r * 0.85 - 7, bar / item.hp - 4, 3);
  }
  ctx.restore();
}

function lantern(ctx, flight, item) {
  for (let i = 0; i < item.trail.length; i++) {
    const part = item.trail[i];
    const p = project(flight.plane, part.x, part.z, part.altitude);
    if (p) { ctx.globalAlpha = i / item.trail.length * 0.5; ellipse(ctx, p.x, p.y, Math.max(1, p.scale * 2), Math.max(1, p.scale * 2), '#ffd18a'); }
  }
  ctx.globalAlpha = 1;
  const p = project(flight.plane, item.x, item.z, item.altitude);
  if (!p) return;
  const size = clamp(p.scale * 6, 2, 15);
  glow(ctx, p.x, p.y, size * 6, '255,193,102', 0.65);
  ctx.fillStyle = '#ffdda0'; ctx.fillRect(p.x - size / 2, p.y - size * 0.8, size, size * 1.4);
  ctx.strokeStyle = '#bc8253'; ctx.lineWidth = 1; ctx.strokeRect(p.x - size / 2, p.y - size * 0.8, size, size * 1.4);
  ctx.fillStyle = '#fff4c7'; ctx.fillRect(p.x - size / 5, p.y, size / 2.5, size / 2);
}

function aircraft(ctx, flight) {
  const { plane, time } = flight;
  const touchdownAge = plane.touchdown ? time - plane.touchdown.at : 100;
  const x = 640 + Math.sin(time * 1.8) * 1.5;
  const y = 510 + plane.pitch * 12 - plane.bounce * 2;
  if (plane.rolling || plane.altitude < 45) {
    const shadow = project(plane, plane.x, plane.z, 0);
    if (shadow) ellipse(ctx, shadow.x, Math.min(HEIGHT - 30, shadow.y), 110, 15, '#101b2255');
  }
  ctx.save(); ctx.translate(x, y); ctx.rotate(plane.bank * 0.48 + (plane.crashed ? -0.35 : 0));
  if (plane.boost > 0) {
    for (const side of [-1, 1]) {
      const trail = ctx.createLinearGradient(side * 145, 20, side * 170, 170);
      trail.addColorStop(0, '#ffe0a0aa'); trail.addColorStop(1, '#ffcb7400');
      ctx.strokeStyle = trail; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(side * 147, 5); ctx.bezierCurveTo(side * 150, 55, side * 160, 110, side * 183, 160); ctx.stroke();
    }
  }
  // Lower wing, wooden frame, and bracing cables beneath the main canvas.
  polygon(ctx, [{ x: -127, y: 23 }, { x: -109, y: 6 }, { x: 108, y: 6 }, { x: 128, y: 23 },
    { x: 103, y: 39 }, { x: -103, y: 39 }], '#a37950', '#4a4439', 2);
  for (const side of [-1, 1]) {
    ctx.strokeStyle = '#423e36'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(side * 23, 40); ctx.lineTo(side * 88, -27); ctx.lineTo(side * 115, 25); ctx.stroke();
    ctx.strokeStyle = '#ead3a5'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(side * 22, 27); ctx.lineTo(side * 143, -8); ctx.lineTo(side * 86, 29); ctx.stroke();
  }
  const cloth = ctx.createLinearGradient(0, -40, 0, 25);
  cloth.addColorStop(0, '#fff0bc'); cloth.addColorStop(0.45, '#e9cc8b'); cloth.addColorStop(1, '#bb8e56');
  polygon(ctx, [{ x: -164, y: -14 }, { x: -147, y: -34 }, { x: -33, y: -46 }, { x: 0, y: -35 },
    { x: 33, y: -46 }, { x: 147, y: -34 }, { x: 164, y: -14 }, { x: 147, y: 13 },
    { x: 32, y: 8 }, { x: 0, y: 0 }, { x: -32, y: 8 }, { x: -147, y: 13 }], cloth, '#493e35', 2.2);
  ctx.strokeStyle = '#876440a0'; ctx.lineWidth = 1;
  for (let rib = -140; rib <= 140; rib += 17.5) {
    if (Math.abs(rib) < 24) continue;
    ctx.beginPath(); ctx.moveTo(rib, -40 + Math.abs(rib) * 0.05);
    ctx.quadraticCurveTo(rib + (rib < 0 ? -5 : 5), -13, rib, 10); ctx.stroke();
  }
  ctx.strokeStyle = '#f8dfa3'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-146, -32); ctx.lineTo(-34, -43); ctx.lineTo(0, -33); ctx.lineTo(34, -43); ctx.lineTo(146, -32); ctx.stroke();
  for (const side of [-1, 1]) {
    polygon(ctx, [{ x: side * 136, y: -31 }, { x: side * 146, y: -31 }, { x: side * 158, y: -13 },
      { x: side * 146, y: 10 }, { x: side * 135, y: 10 }], '#a95540');
    // Painted courier insignia: a lantern in a narrow brass circle.
    ellipse(ctx, side * 100, -12, 12, 9, '#55726b');
    ctx.fillStyle = '#ffe1a1'; ctx.fillRect(side * 100 - 3, -17, 6, 9);
  }
  // Tailplane and a tapering boat-shaped lantern fuselage.
  polygon(ctx, [{ x: -65, y: 55 }, { x: -48, y: 39 }, { x: 48, y: 39 }, { x: 65, y: 55 },
    { x: 40, y: 67 }, { x: -40, y: 67 }], '#e3c288', '#514436', 2);
  ctx.strokeStyle = '#a27049'; ctx.lineWidth = 1;
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(side * 29, 43); ctx.lineTo(side * 33, 64); ctx.moveTo(side * 43, 44); ctx.lineTo(side * 48, 62); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(0, -70);
  ctx.bezierCurveTo(35, -54, 30, -9, 21, 22);
  ctx.bezierCurveTo(15, 45, 9, 64, 0, 75);
  ctx.bezierCurveTo(-10, 64, -17, 43, -22, 20);
  ctx.bezierCurveTo(-31, -15, -32, -54, 0, -70); ctx.closePath();
  const hull = ctx.createLinearGradient(-30, 0, 30, 0);
  hull.addColorStop(0, '#8c593d'); hull.addColorStop(0.24, '#d4a16a'); hull.addColorStop(0.5, '#ffe1a0'); hull.addColorStop(1, '#885639');
  ctx.fillStyle = hull; ctx.fill(); ctx.strokeStyle = '#4b3c31'; ctx.lineWidth = 2; ctx.stroke();
  glow(ctx, 0, -2, 65, '255,182,85', 0.36);
  ellipse(ctx, 0, -13, 15, 27, '#f2bd6c');
  ellipse(ctx, 0, -19, 10, 16, '#e7e4bb');
  ellipse(ctx, 0, -22, 8, 11, '#426168');
  ctx.strokeStyle = '#a4794a'; ctx.lineWidth = 2;
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(side * 9, -60); ctx.quadraticCurveTo(side * 27, -16, side * 6, 60); ctx.stroke();
    ctx.strokeStyle = '#edcf94'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(side * 20, -4); ctx.lineTo(side * 32, 50); ctx.lineTo(side * 30, 69); ctx.stroke();
    ctx.strokeStyle = '#594834'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(side * 30, 47); ctx.lineTo(side * 34, 69); ctx.lineTo(side * 22, 75); ctx.stroke();
    ctx.strokeStyle = '#a4794a'; ctx.lineWidth = 2;
  }
  polygon(ctx, [{ x: 0, y: 38 }, { x: -6, y: 56 }, { x: 0, y: 75 }, { x: 8, y: 59 }], '#bc7550', '#5b4635', 1.5);
  ctx.strokeStyle = '#453a32'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-22, -57); ctx.lineTo(22, -57); ctx.stroke();
  ctx.save(); ctx.translate(0, -66); ctx.scale(1, 0.27); ctx.rotate(time * (25 + plane.throttle * 29));
  ctx.strokeStyle = '#ffe8b380'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(-43, 0); ctx.lineTo(43, 0); ctx.moveTo(0, -43); ctx.lineTo(0, 43); ctx.stroke();
  ctx.restore();
  ellipse(ctx, 0, -66, 4, 4, '#fff2c6');
  for (const side of [-1, 1]) {
    glow(ctx, side * 154, -11, 25, side < 0 ? '255,141,101' : '219,230,169', 0.6);
    ellipse(ctx, side * 154, -11, 3, 2, side < 0 ? '#ffb18a' : '#deefbf');
  }
  if (plane.damage > 35 || plane.crashed || touchdownAge < 0.7) {
    const count = plane.crashed ? 20 : 8;
    for (let i = 0; i < count; i++) {
      const age = (time * 1.4 + i / count) % 1;
      ellipse(ctx, Math.sin(i * 2.4) * age * 45, 40 + age * 100,
        5 + age * 22, 3 + age * 16, `rgba(63,58,57,${(1 - age) * 0.45})`);
      if (plane.crashed) {
        const flame = 0.5 + hashNoise(i + Math.floor(time * 12), flight.seed) * 0.5;
        polygon(ctx, [{ x: -20 + i * 2, y: 20 }, { x: -25 + i * 2, y: -45 * flame },
          { x: -12 + i * 2, y: 18 }], i % 2 ? '#ffd586' : '#e88b50');
      }
    }
  }
  ctx.restore();
  if (plane.touchdown && touchdownAge < 1.7) {
    for (let i = 0; i < 12; i++) {
      const spread = touchdownAge * (60 + i * 7);
      const alpha = Math.max(0, (1 - touchdownAge / 1.7) * 0.3);
      ellipse(ctx, x + (i % 2 ? 1 : -1) * (30 + spread), y + 73 + i % 3 * 7,
        14 + touchdownAge * 18, 7 + touchdownAge * 5, `rgba(244,211,158,${alpha})`);
    }
  }
}

function guidance(ctx, flight) {
  const target = nextTarget(flight);
  const p = project(flight.plane, target.x, target.z, target.type === 'runway' ? 8 : target.altitude);
  if (!p || p.x < 35 || p.x > 1245 || p.y < 125 || p.y > 470) return;
  if (target.type === 'boss' || target.type === 'ring') return;
  ctx.textAlign = 'center'; ctx.font = '11px Trebuchet MS, sans-serif';
  ctx.fillStyle = '#ffdda6'; ctx.shadowColor = '#14232b'; ctx.shadowBlur = 6;
  const text = target.type === 'runway' ? 'RUNWAY 07   ·   42–68 m/s' : target.name;
  ctx.fillText(text, p.x, p.y - 25);
  ctx.shadowBlur = 0;
}

export function renderWorld(ctx, flight) {
  ctx.save();
  sky(ctx, flight);
  terrain(ctx, flight);
  const { world, plane } = flight;
  const objects = [];
  const add = (items, draw) => {
    for (const item of items) if (item.z > plane.z - 220 && item.z < plane.z + 5100) objects.push({ item, draw });
  };
  add(world.trees, tree); add(world.villages, village); add(world.runways, runway);
  add(world.rings, ring); add(world.clouds, cloud);
  if (flight.mission.id === 'pass') add(world.passes, pass);
  if (flight.mission.id === 'storm') add(world.bosses, boss);
  add(flight.projectiles, lantern);
  objects.sort((a, b) => a.item.z - b.item.z);
  for (const { item, draw } of objects) draw(ctx, flight, item);
  guidance(ctx, flight);
  // Thin wind filaments communicate speed without obscuring the landscape.
  if (plane.speed > 92) {
    ctx.strokeStyle = '#ffe4b72b'; ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      const side = i % 2 ? 1 : -1;
      const y = 280 + ((flight.time * plane.speed * 0.8 + i * 73) % 300);
      const x = 640 + side * (220 + i * 23);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + side * 20, y + 50); ctx.stroke();
    }
  }
  aircraft(ctx, flight);
  const vignette = ctx.createRadialGradient(640, 350, 280, 640, 360, 790);
  vignette.addColorStop(0, '#14232b00'); vignette.addColorStop(1, '#101d2959');
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  if (plane.boostFlash > 0) {
    ctx.strokeStyle = `rgba(255,215,143,${plane.boostFlash * 0.4})`;
    ctx.lineWidth = 3; ctx.strokeRect(7, 7, WIDTH - 14, HEIGHT - 14);
  }
  ctx.restore();
}
