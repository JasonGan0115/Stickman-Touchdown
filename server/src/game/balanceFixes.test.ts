import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { getAIBonus } from "./ai";
import { LOADOUT_AUGMENT_SLOTS, LOADOUT_UNIT_SLOTS, STARTING_MANA } from "./constants";
import { getIsoWeekKey, getWeeklyTournamentLoadout } from "./tournament";

describe("weekly tournament ISO rotation", () => {
  test("selects 8 unique troops and 8 unique augments and rotates across ISO weeks", () => {
    const w1 = getWeeklyTournamentLoadout(new Date("2026-11-16T00:00:00Z"));
    const w2 = getWeeklyTournamentLoadout(new Date("2026-11-23T00:00:00Z"));

    assert.equal(w1.loadout.unitIds.length, LOADOUT_UNIT_SLOTS);
    assert.equal(new Set(w1.loadout.unitIds).size, LOADOUT_UNIT_SLOTS);
    assert.equal(w1.loadout.augmentIds.length, LOADOUT_AUGMENT_SLOTS);
    assert.equal(new Set(w1.loadout.augmentIds).size, LOADOUT_AUGMENT_SLOTS);

    assert.notEqual(w1.id, w2.id);
    assert.equal(w2.id, getIsoWeekKey(new Date("2026-11-23T00:00:00Z")).id);
    assert.notDeepEqual(w1.loadout.unitIds, w2.loadout.unitIds);
  });
});

describe("VS AI scaling (VS_AI_BALANCE_GOALS.md)", () => {
  test("levels 1-10 are neutral and beginner-friendly", () => {
    for (let lvl = 1; lvl <= 10; lvl++) {
      const b = getAIBonus(lvl);
      assert.equal(b.startingLiquid, STARTING_MANA);
      assert.equal(b.manaRegenMultiplier, 1);
      assert.equal(b.cooldownFactor, 1);
      assert.equal(b.predictionChance, 0);
      assert.equal(b.damageDebuff, 0);
    }
  });

  test("difficulty ramps monotonically from level 10 to 50 to 100", () => {
    const b10 = getAIBonus(10);
    const b30 = getAIBonus(30);
    const b50 = getAIBonus(50);
    const b100 = getAIBonus(100);

    assert.ok(b10.manaRegenMultiplier < b30.manaRegenMultiplier);
    assert.ok(b30.manaRegenMultiplier < b50.manaRegenMultiplier);
    assert.ok(b50.manaRegenMultiplier < b100.manaRegenMultiplier);

    assert.ok(b10.damageDebuff < b30.damageDebuff);
    assert.ok(b30.damageDebuff < b50.damageDebuff);
    assert.ok(b50.damageDebuff < b100.damageDebuff);

    assert.ok(b10.cooldownFactor > b50.cooldownFactor);
    assert.ok(b50.cooldownFactor > b100.cooldownFactor);
  });
});
