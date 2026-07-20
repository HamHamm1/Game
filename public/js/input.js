// Unified input: WASD / arrow keys on desktop, on-screen joystick on mobile.
export function createInput({ onInteract }) {
  const state = { up: false, down: false, left: false, right: false };
  const keyMap = {
    KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  };

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (keyMap[e.code]) { state[keyMap[e.code]] = true; e.preventDefault(); }
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') onInteract?.();
  });
  window.addEventListener('keyup', (e) => {
    if (keyMap[e.code]) { state[keyMap[e.code]] = false; e.preventDefault(); }
  });

  // ---- Virtual joystick ----
  const stick = document.getElementById('joystick');
  const nub = document.getElementById('joy-nub');
  if (stick) {
    let active = null, cx = 0, cy = 0;
    const R = 48;
    const start = (e) => {
      const t = e.changedTouches ? e.changedTouches[0] : e;
      active = t.identifier ?? 'mouse';
      const r = stick.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      move(e); e.preventDefault();
    };
    const move = (e) => {
      if (active === null) return;
      const t = [...(e.changedTouches || [e])].find((x) => (x.identifier ?? 'mouse') === active) || (e.changedTouches ? null : e);
      if (!t) return;
      let dx = t.clientX - cx, dy = t.clientY - cy;
      const d = Math.hypot(dx, dy) || 1;
      const cl = Math.min(d, R);
      nub.style.transform = `translate(${(dx / d) * cl}px, ${(dy / d) * cl}px)`;
      const th = 0.35 * R;
      state.left = dx < -th; state.right = dx > th;
      state.up = dy < -th; state.down = dy > th;
      e.preventDefault();
    };
    const end = (e) => {
      active = null; nub.style.transform = 'translate(0,0)';
      state.up = state.down = state.left = state.right = false;
    };
    stick.addEventListener('touchstart', start, { passive: false });
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end);
    stick.addEventListener('mousedown', start);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
  }

  const act = document.getElementById('btn-action');
  if (act) act.addEventListener('click', () => onInteract?.());

  return { state };
}
