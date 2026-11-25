import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { DEFAULT_HAND, getUnitStats, resolveDeck, resolveHand, UNIT_STATS } from "./units";

describe("64-troop catalog", () => {
  test("contains exactly 64 unique troops", () => {
    const keys = Object.keys(UNIT_STATS);
    assert.equal(keys.length, 64);
  });

  test("every troop has valid stats, cardId, type, and movement", () => {
    const validTypes = new Set(["Melee", "Ranged", "Tank", "Caster"]);
    const validMovements = new Set(["walking", "running", "sliding", "flying"]);

    const movementsFound = new Set<string>();
    const typesFound = new Set<string>();

    for (const [key, unit] of Object.entries(UNIT_STATS)) {
      assert.equal(unit.cardId, key, `cardId mismatch for ${key}`);
      assert.ok(unit.name.length > 0, `empty name for ${key}`);
      assert.ok(validTypes.has(unit.type), `invalid type ${unit.type} for ${key}`);
      assert.ok(validMovements.has(unit.movement), `invalid movement ${unit.movement} for ${key}`);
      assert.ok(unit.cost >= 1 && unit.cost <= 6, `invalid cost ${unit.cost} for ${key}`);
      assert.ok(unit.health > 0, `invalid health for ${key}`);
      assert.ok(unit.damage > 0, `invalid damage for ${key}`);
      assert.ok(unit.attackRange >= 30, `invalid attackRange for ${key}`);
      assert.ok(unit.attackIntervalTicks > 0, `invalid attackIntervalTicks for ${key}`);
      assert.ok(unit.speed > 0, `invalid speed for ${key}`);
      assert.ok(unit.splashRadius >= 0, `invalid splashRadius for ${key}`);

      movementsFound.add(unit.movement);
      typesFound.add(unit.type);
    }

    assert.equal(movementsFound.size, 4, "all 4 movement types must be present");
    assert.equal(typesFound.size, 4, "all 4 combat types must be present");
  });

  test("getUnitStats retrieves correct unit or undefined", () => {
    assert.equal(getUnitStats("card_quarterback")?.name, "Quarterback");
    assert.equal(getUnitStats("card_touchdown_god")?.name, "Touchdown God");
    assert.equal(getUnitStats("card_nonexistent"), undefined);
  });

  test("DEFAULT_HAND provides the initial 8 starter troops", () => {
    assert.equal(DEFAULT_HAND.length, 8);
    for (const cardId of DEFAULT_HAND) {
      assert.ok(getUnitStats(cardId) !== undefined);
    }
  });

  test("resolveDeck and resolveHand support customized 8-troop loadouts from catalog", () => {
    const custom8 = [
      "card_quarterback",
      "card_wide_receiver",
      "card_slime_ninja",
      "card_sky_valkyrie",
      "card_tar_golem",
      "card_blitz_rusher",
      "card_tar_dragon",
      "card_touchdown_god",
    ];
    const resolved = resolveDeck(custom8);
    assert.deepEqual(resolved, custom8);

    const { hand, drawQueue } = resolveHand(custom8);
    assert.equal(hand.length, 4);
    assert.equal(drawQueue.length, 4);
    assert.deepEqual(hand, custom8.slice(0, 4));
    assert.deepEqual(drawQueue, custom8.slice(4));
  });
});
