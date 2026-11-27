// Mirrors of server/src/game/constants.ts. The server is authoritative; these
// are only used for drawing and quick client-side feedback. Keep them in sync.

// World size in server units (9:16). The arena scales this to fit the screen.
export const FIELD_WIDTH = 360;
export const FIELD_HEIGHT = 640;
export const ENDZONE_DEPTH = FIELD_HEIGHT * 0.15; // 96 units: each endzone is 15% of the field

export const MAX_MANA = 10;
export const STARTING_MANA = 3;
export const RESET_MANA_ON_SCORE = 5;
export const SPAWN_COOLDOWN_MS = 1000;
// Each card's mana cost comes from the server in 'match_found' (see HandCard)
export const TICK_MS = 1000 / 30;

export const LOADOUT_UNIT_SLOTS = 8;
export const ACTIVE_HAND_SIZE = 4;
export const LOADOUT_AUGMENT_SLOTS = 8;

export const SPRITE_SIZE = 40; // px, rendered size of a stickman unit
