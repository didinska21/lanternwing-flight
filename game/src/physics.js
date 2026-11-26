import { TUNING, VALLEY_LENGTH, clamp, lerp } from './config.js';
import { runwayAt } from './world.js';

export function createPlane(world, mission, upgrades = {}, damage = 0) {
  const z = mission.valleys[0] * VALLEY_LENGTH + 70;
  const maxFuel = TUNING.startingFuel + (upgrades.tank || 0) * 24;
  return { x: world.riverX(z), z, previousZ: z, altitude: 150, previousAltitude: 150,
    speed: 76, throttle: 0.6, heading: 0, bank: 0, pitch: 0, verticalSpeed: 0,
    maxFuel, fuel: maxFuel, damage, cargo: TUNING.startingCargo + (upgrades.rack || 0) * 4,
    boost: 0, boostFlash: 0, cooldown: 0, grounded: false, rolling: false,
    landed: false, crashed: false, touchdown: null, rollTime: 0, bounce: 0,
    distance: 0, turnStress: 0, upgrades: { ...upgrades }, flame: 0 };
}

export function stepPhysics(plane, controls, world, time, dt) {
  if (plane.crashed || plane.landed) return;
  plane.previousZ = plane.z;
  plane.previousAltitude = plane.altitude;
  plane.cooldown = Math.max(0, plane.cooldown - dt);
  plane.boost = Math.max(0, plane.boost - dt);
  plane.boostFlash = Math.max(0, plane.boostFlash - dt);
  plane.bounce = Math.max(0, plane.bounce - dt * 9);
  const u = plane.upgrades;
  const authority = 0.6 + Math.min(plane.speed / 90, 0.55);
  const turn = clamp(controls.turn || 0, -1, 1);
  const pitch = clamp(controls.pitch || 0, -1, 1);
  plane.throttle = clamp(plane.throttle + ((controls.throttle || 0) + pitch * 0.24) * dt * 0.42, 0, 1);
  plane.bank = lerp(plane.bank, turn * 0.83, Math.min(1, dt * 3.9));
  plane.pitch = lerp(plane.pitch, pitch, Math.min(1, dt * 3.2));

  if (plane.rolling) {
    plane.rollTime += dt;
    plane.speed = Math.max(0, plane.speed - dt * (12 + (controls.pitch < 0 ? 7 : 0)));
    plane.heading = clamp(plane.heading + turn * dt * 0.22, -0.55, 0.55);
    plane.x += Math.sin(plane.heading) * plane.speed * dt;
    plane.z += plane.speed * dt;
    plane.altitude = Math.max(0, Math.sin(plane.rollTime * 12) * plane.bounce);
    const runway = runwayAt(world, plane);
    if (!runway && plane.speed > 17) plane.damage += dt * 24;
    if (plane.speed < 9 || plane.rollTime > 6) plane.landed = true;
    if (plane.damage >= 100) crash(plane, 'The wing broke during the rollout.');
    return;
  }

  const engine = plane.fuel > 0 ? plane.throttle : 0;
  const maxSpeed = TUNING.maxSpeed + (u.engine || 0) * 7;
  const targetSpeed = 24 + engine * (maxSpeed - 24) + (plane.boost > 0 ? 28 : 0) - pitch * 9;
  plane.speed += (targetSpeed - plane.speed) * dt * (0.38 + (u.propeller || 0) * 0.09);
  plane.speed = Math.max(14, plane.speed);
  plane.fuel = Math.max(0, plane.fuel - dt * (0.2 + engine * engine * 0.37) * (1 - (u.valve || 0) * 0.12));
  plane.heading = clamp(plane.heading + turn * dt * 0.61 * authority, -1.18, 1.18);
  const overspeed = Math.max(0, (plane.speed - 88) / 32);
  plane.turnStress = Math.abs(plane.bank) * (1 + overspeed * 2.4);
  const lostLift = plane.bank * plane.bank * (4 + overspeed * 31) * (1 - (u.wing || 0) * 0.18);
  const stallSink = Math.max(0, (TUNING.stall + plane.damage * 0.06 - plane.speed)) * 1.05;
  const liftTrim = (plane.speed - TUNING.cruise) * 0.055;
  const targetClimb = pitch * (25 + (u.engine || 0) * 1.5) + liftTrim - lostLift - stallSink
    + (plane.boost > 0 ? 2.6 : 0) - (plane.fuel === 0 ? 5.5 : 0);
  plane.verticalSpeed = lerp(plane.verticalSpeed, targetClimb, Math.min(1, dt * (2.2 + (u.trim || 0) * 0.4)));
  const gust = Math.sin(time * 1.17 + world.phase) * (plane.z > 5 * VALLEY_LENGTH ? 2.6 : 0.45);
  plane.x += (Math.sin(plane.heading) * plane.speed + gust) * dt;
  const forward = Math.max(9, Math.cos(plane.heading) * plane.speed);
  plane.z += forward * dt;
  plane.distance += forward * dt;
  plane.altitude = Math.min(TUNING.maxAltitude, plane.altitude + plane.verticalSpeed * dt);
  if (plane.altitude === TUNING.maxAltitude) plane.verticalSpeed = Math.min(0, plane.verticalSpeed);
  if (Math.abs(plane.x - world.riverX(plane.z)) > 1450 && plane.altitude < 280) {
    plane.damage += dt * 21;
    plane.verticalSpeed -= dt * 6;
  }
  if (plane.altitude <= 1.5) {
    const runway = runwayAt(world, plane);
    const sink = Math.abs(Math.min(0, plane.verticalSpeed));
    const tolerance = 7 + (u.skids || 0) * 1.5;
    const safeSpeed = plane.speed < 72 + (u.skids || 0) * 3 && plane.speed > 23;
    if (runway && safeSpeed && sink < tolerance + 6 && Math.abs(plane.heading) < 0.42) {
      const impact = Math.max(0, sink - 3.8) * 7 * (1 - (u.wing || 0) * 0.1);
      plane.damage = Math.min(100, plane.damage + impact);
      plane.touchdown = { sink, speed: plane.speed, hard: sink > tolerance, at: time, damage: impact };
      plane.rolling = true;
      plane.bounce = Math.min(6, Math.max(0, sink - 2) * 0.8);
      plane.altitude = plane.bounce;
      plane.verticalSpeed = 0;
      if (plane.damage >= 100) crash(plane, 'The landing impact tore the wing.');
    } else {
      crash(plane, runway ? 'Too fast, too steep, or too sideways for the runway.' : 'The courier came down beyond the runway lights.');
    }
  }
  if (plane.damage >= 100) crash(plane, 'The lantern wing could not hold together.');
}

export function crash(plane, reason) {
  plane.crashed = true;
  plane.damage = 100;
  plane.crashReason = reason;
  plane.flame = 1;
  plane.altitude = Math.max(1, plane.altitude);
}
