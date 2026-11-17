// Keyboard and mouse input. Held keys are a live set the simulation reads every step;
// one-shot presses (interact, pause, confirm) are latched into flags the game loop
// consumes once, so a press between frames is never lost or counted twice.

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  let wheel = 0;

  function codeOf(event) {
    return event.code;
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'F5'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) pressed.add(codeOf(event));
    held.add(codeOf(event));
  });
  window.addEventListener('keyup', (event) => held.delete(codeOf(event)));
  window.addEventListener('blur', () => {
    held.clear();
    mouse.down = false;
  });

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      mouse.down = true;
      mouse.clicked = true;
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouse.down = false;
  });
  canvas.addEventListener('wheel', (event) => {
    wheel += Math.sign(event.deltaY);
  }, { passive: true });

  return {
    mouse,
    down(...codes) {
      return codes.some((code) => held.has(code));
    },
    /** True once per physical press; consumes the latch. */
    tap(...codes) {
      for (const code of codes) {
        if (pressed.has(code)) {
          pressed.delete(code);
          return true;
        }
      }
      return false;
    },
    clicked() {
      const was = mouse.clicked;
      mouse.clicked = false;
      return was;
    },
    wheelDelta() {
      const value = wheel;
      wheel = 0;
      return value;
    },
    /** Movement axes: x -1..1, y -1..1 from WASD or the arrow keys. */
    axes() {
      let x = 0;
      let y = 0;
      if (this.down('KeyA', 'ArrowLeft')) x -= 1;
      if (this.down('KeyD', 'ArrowRight')) x += 1;
      if (this.down('KeyW', 'ArrowUp')) y -= 1;
      if (this.down('KeyS', 'ArrowDown')) y += 1;
      return { x, y };
    },
  };
}
