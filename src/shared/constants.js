// Shared gameplay constants (server-side copy).
// Keep in sync with public/js/shared.js on the client.
export const TILE = 32;              // pixel size of one tile
export const MAP_W = 60;             // map width in tiles
export const MAP_H = 44;             // map height in tiles
export const TICK_HZ = 15;           // server broadcast rate
export const PLAYER_SPEED = 6;       // pixels per server tick (~90 px/s)
export const MAX_CHAT_LEN = 200;

// Player lifecycle states controlled by the admin.
export const STATUS = {
  PENDING: 'pending',   // waiting for admin approval
  APPROVED: 'approved', // may move & interact
  BANNED: 'banned',     // rejected / kicked
};

export const MSG = {
  // client -> server
  HELLO: 'hello',
  MOVE: 'move',
  CHAT: 'chat',
  INTERACT: 'interact',
  DIALOGUE_CHOICE: 'dialogue_choice',
  // server -> client
  WELCOME: 'welcome',
  STATE: 'state',
  CONTENT: 'content',
  STATUS: 'status',
  CHAT_MSG: 'chat_msg',
  DIALOGUE: 'dialogue',
  TOAST: 'toast',
  KICK: 'kick',
};
