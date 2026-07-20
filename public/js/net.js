// WebSocket client wrapper.
import { MSG } from '/shared/constants.js';

export function connect({ id, name, handlers }) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}/ws`);
  let moveTimer = null;
  const lastInput = { up: 0, down: 0, left: 0, right: 0 };

  ws.addEventListener('open', () => {
    ws.send(JSON.stringify({ type: MSG.HELLO, id, name }));
  });
  ws.addEventListener('message', (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    handlers[m.type]?.(m);
  });
  ws.addEventListener('close', () => handlers.__close?.());

  function sendMove(state) {
    if (ws.readyState !== 1) return;
    // Only transmit when the input actually changes.
    if (state.up === lastInput.up && state.down === lastInput.down &&
        state.left === lastInput.left && state.right === lastInput.right) return;
    Object.assign(lastInput, state);
    ws.send(JSON.stringify({ type: MSG.MOVE, ...state }));
  }
  const api = {
    sendMove,
    chat: (text) => ws.readyState === 1 && ws.send(JSON.stringify({ type: MSG.CHAT, text })),
    interact: () => ws.readyState === 1 && ws.send(JSON.stringify({ type: MSG.INTERACT })),
    choose: (index) => ws.readyState === 1 && ws.send(JSON.stringify({ type: MSG.DIALOGUE_CHOICE, index })),
  };
  return api;
}
