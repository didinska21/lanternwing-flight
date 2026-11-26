export function createInput(canvas, onCommand, onGesture) {
  const keys = new Set();
  const mouse = { active: false, x: 0, y: 0 };
  const handled = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight']);
  window.addEventListener('keydown', event => {
    if (handled.has(event.code)) event.preventDefault();
    onGesture();
    keys.add(event.code);
    if (!event.repeat) {
      if (event.code === 'Escape' || event.code === 'KeyP') onCommand('pause');
      if (event.code === 'KeyM') onCommand('mute');
      if (event.code === 'KeyR') onCommand('retry');
    }
  });
  window.addEventListener('keyup', event => keys.delete(event.code));
  window.addEventListener('blur', () => { keys.clear(); mouse.active = false; onCommand('blur'); });
  canvas.addEventListener('pointerdown', event => {
    onGesture();
    if (event.button === 0) { mouse.active = true; canvas.setPointerCapture?.(event.pointerId); }
  });
  canvas.addEventListener('pointermove', event => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (event.clientX - rect.left) / rect.width * 2 - 1;
    mouse.y = (event.clientY - rect.top) / rect.height * 2 - 1;
  });
  window.addEventListener('pointerup', () => { mouse.active = false; });
  const pressed = (...codes) => codes.some(code => keys.has(code)) ? 1 : 0;
  return {
    read() {
      return {
        turn: pressed('ArrowRight', 'KeyD') - pressed('ArrowLeft', 'KeyA') || (mouse.active ? mouse.x : 0),
        pitch: pressed('ArrowUp', 'KeyW') - pressed('ArrowDown', 'KeyS') || (mouse.active ? -mouse.y : 0),
        throttle: pressed('KeyE', 'ShiftLeft', 'ShiftRight') - pressed('KeyQ', 'ControlLeft', 'ControlRight'),
        action: !!pressed('Space'),
      };
    },
    clear() { keys.clear(); mouse.active = false; },
  };
}
