import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { ENDZONE_DEPTH, FIELD_HEIGHT } from "./constants";
import { createMatch, trySpawn } from "./match";
import {
  getCumulativeXpForLevel,
  getTroopLevelFromXp,
  getTroopLevelProgress,
  getTroopStatMultiplier,
  MAX_TROOP_LEVEL,
  MIN_HOURS_FOR_MAX_LEVEL,
  TROOP_XP_PER_SECOND,
} from "./troopLevels";
import { DEFAULT_HAND } from "./units";

describe("troopLevels", () => {
  test("level 1 starts at 0 XP and requires at least 100 hours to reach level 100", () => {
    assert.equal(getTroopLevelFromXp(0), 1);
    const minSeconds = MIN_HOURS_FOR_MAX_LEVEL * 3600 * TROOP_XP_PER_SECOND;
    assert.ok(
      getTroopLevelFromXp(minSeconds - 1) < MAX_TROOP_LEVEL,
      "Cannot reach level 100 in less than 100 hours",
    );

    const maxXp = getCumulativeXpForLevel(MAX_TROOP_LEVEL);
    assert.ok(maxXp >= minSeconds, `Level 100 requires at least ${minSeconds} XP (got ${maxXp})`);
    assert.equal(getTroopLevelFromXp(maxXp), MAX_TROOP_LEVEL);
    assert.equal(getTroopLevelFromXp(maxXp * 2), MAX_TROOP_LEVEL);

    const progress = getTroopLevelProgress(maxXp);
    assert.equal(progress.level, MAX_TROOP_LEVEL);
    assert.ok(progress.hoursPlayed >= 100);
  });

  test("trySpawn tracks playedCardCounts and scales stats only above level 1", () => {
    const cardId = DEFAULT_HAND[0];
    const match = createMatch(
      "m_troop_lvl",
      "standard",
      { id: "p1", username: "Alice", loadout: { unitIds: DEFAULT_HAND, augmentIds: [] }, troopLevels: { [cardId]: 1 } },
      { id: "p2", username: "Bob", loadout: { unitIds: DEFAULT_HAND, augmentIds: [] }, troopLevels: { [cardId]: 100 } },
    );

    const [p1, p2] = match.players;
    p1.mana = 10;
    p2.mana = 10;

    const r1 = trySpawn(match, p1, cardId, 100, FIELD_HEIGHT - ENDZONE_DEPTH / 2);
    const r2 = trySpawn(match, p2, cardId, 100, ENDZONE_DEPTH / 2);

    assert.equal(r1.ok, true);
    assert.equal(r2.ok, true);
    if (!r1.ok || !r2.ok) return;

    assert.equal(p1.playedCardCounts[cardId], 1);
    assert.equal(p2.playedCardCounts[cardId], 1);
    assert.equal(getTroopStatMultiplier(1), 1);
    assert.ok(r2.entity.maxHealth > r1.entity.maxHealth);
    assert.ok(r2.entity.damage > r1.entity.damage);
  });
});
