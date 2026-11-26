import { VALLEYS, VALLEY_LENGTH, BOSSES, TUNING, clamp } from './config.js';
import { makeRandom } from './random.js';

export function createWorld(seed) {
  const random = makeRandom(seed);
  const phase = random() * Math.PI * 2;
  const riverX = z => Math.sin(z / 1020 + phase) * 155 + Math.sin(z / 470 + phase * 0.4) * 54;
  const rings = [], villages = [], trees = [], clouds = [], runways = [], passes = [];
  for (let valley = 0; valley < VALLEYS.length; valley++) {
    const start = valley * VALLEY_LENGTH;
    for (let i = 0; i < VALLEYS[valley].rings; i++) {
      const z = start + 630 + i * (2200 / Math.max(1, VALLEYS[valley].rings - 1));
      rings.push({ id: rings.length, valley, x: riverX(z) + Math.sin(i * 1.7 + valley) * 76,
        z, altitude: 145 + Math.sin(i * 1.5 + valley) * 34, radius: TUNING.ringRadius, collected: false, collectedAt: -100 });
    }
    for (let i = 0; i < 3; i++) {
      const z = start + 700 + i * 880;
      const x = riverX(z) + (valley % 2 ? 1 : -1) * (205 + i * 12);
      const houses = Array.from({ length: 9 }, (_, index) => ({
        x: (index % 3 - 1) * 37 + (random() - 0.5) * 15,
        z: (Math.floor(index / 3) - 1) * 38,
        width: 14 + random() * 8, height: 12 + random() * 9,
        roof: random() > 0.5, warmth: random(),
      }));
      villages.push({ id: villages.length, valley, x, z, houses, lit: false, delivered: false,
        name: ['Hearth', 'Ferry', 'Hollow'][i] + ' of ' + VALLEYS[valley].name });
    }
    for (let i = 0; i < 155 * VALLEYS[valley].trees; i++) {
      const z = start + random() * VALLEY_LENGTH;
      const side = random() < 0.5 ? -1 : 1;
      const x = riverX(z) + side * (125 + random() * 1050);
      trees.push({ x, z, height: 17 + random() * 30, shade: random(), width: 7 + random() * 7 });
    }
    for (let i = 0; i < 12; i++) {
      clouds.push({ x: (random() - 0.5) * 3400, z: start + random() * VALLEY_LENGTH,
        altitude: 420 + random() * 270, size: 90 + random() * 180, shade: random() });
    }
    const z = start + 3130;
    runways.push({ valley, x: riverX(z) + 365, z, start: start + 2780, end: start + 3500, width: 122 });
  }
  for (const [index, offset] of [1330, 2310].entries()) {
    const z = 3 * VALLEY_LENGTH + offset;
    passes.push({ id: index, z, x: riverX(z), halfWidth: 138, floor: 55, ceiling: 230, crossed: false });
  }
  const bosses = BOSSES.map((boss, id) => ({ ...boss, id, z: boss.valley * VALLEY_LENGTH + boss.offset,
    x: riverX(boss.valley * VALLEY_LENGTH + boss.offset), altitude: 195, health: boss.hp,
    defeated: false, hitAt: -100, strike: null, nextStrike: 4 + boss.phase }));
  return { seed, phase, riverX, rings, villages, trees, clouds, runways, passes, bosses };
}

export function valleyAt(z) {
  return clamp(Math.floor(z / VALLEY_LENGTH), 0, VALLEYS.length - 1);
}

export function runwayAt(world, plane) {
  return world.runways.find(runway => plane.z >= runway.start && plane.z <= runway.end + 110
    && Math.abs(plane.x - runway.x) < runway.width / 2);
}

export function project(plane, x, z, altitude = 0) {
  const depth = z - plane.z + TUNING.cameraBehind;
  if (depth < 32) return null;
  const scale = TUNING.focal / depth;
  return { x: 640 + (x - plane.x) * scale - Math.sin(plane.heading) * 58,
    y: TUNING.horizon + (plane.altitude + TUNING.cameraAbove - altitude) * scale,
    scale, depth };
}

export function routeEnd(flight) {
  return flight.world.runways[flight.mission.valleys[1]];
}

export function nextTarget(flight) {
  const { plane, world, mission } = flight;
  const inRoute = item => item.valley >= mission.valleys[0] && item.valley <= mission.valleys[1];
  if (flight.objectiveDone) return { ...routeEnd(flight), altitude: 0, type: 'runway', name: 'HOME RUNWAY' };
  if (mission.id === 'rings') {
    const ring = world.rings.find(item => inRoute(item) && !item.collected && item.z > plane.z - 20);
    if (ring) return { ...ring, type: 'ring', name: 'SKY-RING ' + (flight.progress + 1) };
  }
  if (mission.id === 'rescue' || mission.id === 'night') {
    const village = world.villages.find(item => inRoute(item) && !item.delivered && item.z > plane.z - 140);
    if (village) return { ...village, altitude: 125, type: 'village', name: 'DELIVERY BEACON' };
  }
  if (mission.id === 'pass') {
    const pass = world.passes.find(item => !item.crossed && item.z > plane.z - 30);
    if (pass) return { ...pass, altitude: 145, type: 'pass', name: 'MOUNTAIN GATE' };
  }
  if (mission.id === 'storm') {
    const boss = world.bosses.find(item => !item.defeated && item.z > plane.z - 100);
    if (boss) return { ...boss, type: 'boss', name: boss.name.toUpperCase() };
  }
  return { ...routeEnd(flight), altitude: 100, type: 'runway', name: 'HOME RUNWAY' };
}
