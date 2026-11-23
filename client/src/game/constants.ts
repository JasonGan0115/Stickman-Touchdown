// Mirrors of server/src/game/constants.ts. The server is authoritative; these
// are only used for drawing and quick client-side feedback. Keep them in sync.

// World size in server units (9:16). The arena scales this to fit the screen.
export const FIELD_WIDTH = 360;
export const FIELD_HEIGHT = 640;
export const ENDZONE_DEPTH = FIELD_HEIGHT * 0.15; // 96 units: each endzone is 15% of the field

export const MAX_MANA = 10;
// Each card's mana cost comes from the server in 'match_found' (see HandCard)
export const TICK_MS = 1000 / 30;

export const LOADOUT_UNIT_SLOTS = 4;
export const LOADOUT_AUGMENT_SLOTS = 8;

export const UNIT_SIZE = 30; // px, rendered size of a unit

/** Letter drawn on each unit so the four types can be told apart on the field. */
export const UNIT_TYPE_LETTER = { Melee: 'M', Ranged: 'R', Tank: 'T', Caster: 'C' } as const;
