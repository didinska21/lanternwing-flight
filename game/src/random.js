// Integer mixing stays independent of wall-clock time and browser frame rate.
export function seedNumber(value = 7) {
  const string = String(value);
  let word = 2166136261;
  for (let i = 0; i < string.length; i++) {
    word = Math.imul(word ^ string.charCodeAt(i), 16777619);
  }
  return word >>> 0;
}

export function makeRandom(seed) {
  let word = seed >>> 0;
  return () => {
    word = (word + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(word ^ (word >>> 15), word | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashNoise(value, salt = 0) {
  let word = Math.imul((value | 0) ^ (salt | 0), 0x45d9f3b);
  word = Math.imul(word ^ (word >>> 16), 0x45d9f3b);
  return ((word ^ (word >>> 16)) >>> 0) / 4294967295;
}
