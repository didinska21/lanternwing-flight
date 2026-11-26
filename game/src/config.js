export const WIDTH = 1280;
export const HEIGHT = 720;
export const STEP = 1 / 60;
export const VALLEY_LENGTH = 3600;
export const PALETTE = Object.freeze({
  ink: '#14232b', panel: '#182b32', cream: '#ffe7b8', gold: '#ffcc79',
  copper: '#d28b5a', peach: '#eb9b77', rose: '#ae6b76', water: '#527b80',
  pine: '#264c48', moss: '#59705a', warning: '#f57c64', mint: '#b6d9b8',
});

export const VALLEYS = Object.freeze([
  { name: 'Alderwake', subtitle: 'Where the river learns to shine', rings: 4, trees: 1, ridge: 0.7 },
  { name: 'Copperbend', subtitle: 'A hundred windows waiting', rings: 4, trees: 0.8, ridge: 0.8 },
  { name: 'Glasswater', subtitle: 'Carry the last light home', rings: 4, trees: 0.65, ridge: 0.65 },
  { name: 'Emberpine Pass', subtitle: 'Between the sleeping giants', rings: 3, trees: 1.3, ridge: 1.5 },
  { name: 'Moonmere', subtitle: 'Small lights against the night', rings: 3, trees: 0.9, ridge: 0.9 },
  { name: 'Cinderstep', subtitle: 'The storm has a name', rings: 3, trees: 0.75, ridge: 1.2 },
  { name: 'Thunder Crown', subtitle: 'Bring back the dawn', rings: 3, trees: 1.1, ridge: 1.5 },
]);

export const MISSIONS = Object.freeze([
  { id: 'rings', name: 'Ring Run', valleys: [0, 0], goal: 4, reward: 36, night: 0.05,
    briefing: 'Thread all four brass sky-rings, then land at Alderwake. Space near a ring gives a short lift boost.', short: 'Thread 4 sky-rings' },
  { id: 'rescue', name: 'River Rescue', valleys: [1, 2], goal: 4, reward: 52, night: 0.16,
    briefing: 'Deliver to four dark riverside villages. Line up with a beacon and release a lantern as the delivery cue glows.', short: 'Supply 4 river villages' },
  { id: 'pass', name: 'Mountain Pass', valleys: [3, 3], goal: 2, reward: 58, night: 0.2,
    briefing: 'Thread both rock passes below 230 m and above 55 m. A fast, steep turn loses lift. Find the lit runway beyond.', short: 'Thread 2 mountain gates' },
  { id: 'night', name: 'Night Lantern', valleys: [4, 4], goal: 3, reward: 64, night: 0.8,
    briefing: 'Wake all three Moonmere villages. Follow the amber beacons through the dusk, then make a gentle night landing.', short: 'Light 3 night villages' },
  { id: 'storm', name: 'Storm Boss', valleys: [5, 6], goal: 3, reward: 110, night: 0.48,
    briefing: 'Disperse all three storm keepers with lantern pulses. Space attacks the nearest keeper. Dodge the marked lightning lanes.', short: 'Disperse 3 storm keepers' },
]);

export const UPGRADES = Object.freeze([
  { id: 'engine', name: 'Brass engine', cost: 28, max: 3, description: '+7 m/s top speed and stronger climb thrust.' },
  { id: 'tank', name: 'Long-range tank', cost: 26, max: 3, description: '+24 fuel capacity for patient valley crossings.' },
  { id: 'wing', name: 'Canvas braces', cost: 30, max: 3, description: '18% less lift loss in a hard turn.' },
  { id: 'rack', name: 'Courier cradles', cost: 24, max: 3, description: 'Carry 4 more delivery and combat lanterns.' },
  { id: 'wick', name: 'Sunheart wicks', cost: 45, max: 2, description: 'Each lantern pulse deals 1 more storm damage.' },
  { id: 'propeller', name: 'Feather propeller', cost: 25, max: 3, description: 'Quicker throttle response and acceleration.' },
  { id: 'trim', name: 'Silk lift trim', cost: 22, max: 3, description: 'More responsive pitch and +4 m ring tolerance.' },
  { id: 'rod', name: 'Copper storm rod', cost: 32, max: 3, description: 'Absorb 22% of incoming lightning damage.' },
  { id: 'skids', name: 'Willow landing skids', cost: 25, max: 3, description: 'Forgive 1.5 m/s more touchdown sink rate.' },
  { id: 'valve', name: 'Thrift valve', cost: 30, max: 3, description: '12% less fuel burn at every throttle setting.' },
  { id: 'lens', name: 'Beacon lens', cost: 24, max: 3, description: '+35 m lantern delivery guidance radius.' },
  { id: 'resonator', name: 'Ring resonator', cost: 28, max: 3, description: 'Longer ring boosts and +2 lantern ring reward.' },
]);

export const BOSSES = Object.freeze([
  { name: 'The Hollow Gale', valley: 5, offset: 1360, hp: 3, size: 125, phase: 0.25 },
  { name: 'The Copper Maw', valley: 5, offset: 2860, hp: 4, size: 145, phase: 1.5 },
  { name: 'The Last Tempest', valley: 6, offset: 1840, hp: 5, size: 170, phase: 2.8 },
]);

export const TUNING = Object.freeze({
  startingFuel: 125, startingCargo: 20, startingWallet: 38, cruise: 76,
  stall: 28, maxSpeed: 126, maxAltitude: 650, ringRadius: 43,
  horizon: 205, focal: 650, cameraBehind: 260, cameraAbove: 124,
});

export const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
export const lerp = (a, b, t) => a + (b - a) * t;
export const upgradeCost = (upgrade, level) => Math.round(upgrade.cost * (1 + level * 0.65));
