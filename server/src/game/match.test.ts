import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { FIELD_HEIGHT, MAX_MANA } from "./constants";
import { addUnit, createMatch, stepMatch, trySpawn, type Match } from "./match";
import { DEFAULT_HAND, UNIT_STATS } from "./units";

const FOOT = UNIT_STATS.card_footsoldier;
const ARCHER = UNIT_STATS.card_archer;
const MAGE = UNIT_STATS.card_battle_mage;

const P1_HOME_Y = FIELD_HEIGHT - 20; // inside Player 1's endzone (bottom)

function newMatch(p1Units: string[] = [], p2Units: string[] = []): Match {
  return createMatch(
    "test",
    "standard",
    { id: "p1", username: "one", loadout: { unitIds: p1Units, augmentIds: [] } },
    { id: "p2", username: "two", loadout: { unitIds: p2Units, augmentIds: [] } },
  );
}

const steps = (match: Match, n: number) => {
  for (let i = 0; i < n; i++) stepMatch(match);
};

describe("hand", () => {
  test("a player without a saved deck gets the default hand", () => {
    const match = newMatch([]);
    assert.deepEqual(match.players[0].hand, DEFAULT_HAND);
  });

  test("the hand keeps the loadout's order and drops unknown and duplicate cards", () => {
    const match = newMatch(["card_archer", "card_nope", "card_archer", "card_footsoldier"]);
    assert.deepEqual(match.players[0].hand, ["card_archer", "card_footsoldier"]);
  });
});

describe("trySpawn", () => {
  test("rejects a card that doesn't exist", () => {
    const match = newMatch();
    const p1 = match.players[0];
    p1.mana = MAX_MANA;
    assert.deepEqual(trySpawn(match, p1, "card_dragon", 100, P1_HOME_Y), { ok: false, reason: "unknown_card" });
    assert.deepEqual(trySpawn(match, p1, 42, 100, P1_HOME_Y), { ok: false, reason: "unknown_card" });
  });

  test("rejects a real card that isn't in the player's hand", () => {
    const match = newMatch(["card_footsoldier"]);
    const p1 = match.players[0];
    p1.mana = MAX_MANA;
    assert.deepEqual(trySpawn(match, p1, "card_archer", 100, P1_HOME_Y), { ok: false, reason: "card_not_in_hand" });
  });

  test("charges the card's own cost and reports it when mana is short", () => {
    const match = newMatch();
    const p1 = match.players[0];

    p1.mana = MAGE.cost - 0.5;
    assert.deepEqual(trySpawn(match, p1, MAGE.cardId, 100, P1_HOME_Y), {
      ok: false,
      reason: "not_enough_mana",
      cost: MAGE.cost,
    });

    p1.mana = MAX_MANA;
    const result = trySpawn(match, p1, MAGE.cardId, 100, P1_HOME_Y);
    assert.ok(result.ok);
    assert.equal(p1.mana, MAX_MANA - MAGE.cost);
    assert.equal(result.entity.type, "Caster");
    assert.equal(result.entity.health, MAGE.health);
    assert.equal(result.entity.damage, MAGE.damage);
  });

  test("still requires the home endzone", () => {
    const match = newMatch();
    const p1 = match.players[0];
    p1.mana = MAX_MANA;
    assert.deepEqual(trySpawn(match, p1, FOOT.cardId, 100, FIELD_HEIGHT / 2), { ok: false, reason: "outside_home_endzone" });
    assert.equal(p1.mana, MAX_MANA, "a rejected spawn costs nothing");
  });
});

describe("stepMatch", () => {
  test("each unit moves at its own speed", () => {
    const match = newMatch();
    const [p1, p2] = match.players;
    const foot = addUnit(match, p1, FOOT, 100, 600);
    const archer = addUnit(match, p2, ARCHER, 300, 40); // far apart, so neither attacks
    stepMatch(match);
    assert.equal(foot.y, 600 - FOOT.speed);
    assert.equal(archer.y, 40 + ARCHER.speed);
  });

  test("an archer stops and shoots from beyond melee range", () => {
    const match = newMatch();
    const [p1, p2] = match.players;
    const archer = addUnit(match, p1, ARCHER, 180, 500);
    const foot = addUnit(match, p2, FOOT, 180, 380); // 120 apart: archer range, not melee range
    stepMatch(match);
    assert.equal(archer.state, "attacking");
    assert.equal(archer.y, 500, "an attacking unit doesn't move");
    assert.equal(foot.health, FOOT.health - ARCHER.damage);
    assert.equal(foot.state, "moving", "the footsoldier can't reach the archer yet");
  });

  test("units hit once per their own attack interval", () => {
    const match = newMatch();
    const [p1, p2] = match.players;
    addUnit(match, p1, FOOT, 180, 330);
    const target = addUnit(match, p2, FOOT, 180, 310);

    stepMatch(match); // first hit lands straight away
    assert.equal(target.health, FOOT.health - FOOT.damage);
    steps(match, FOOT.attackIntervalTicks - 1);
    assert.equal(target.health, FOOT.health - FOOT.damage, "no second hit before the interval is up");
    stepMatch(match);
    assert.equal(target.health, FOOT.health - 2 * FOOT.damage);
  });

  test("a battle mage's hit splashes enemies near its target, not distant ones", () => {
    const match = newMatch();
    const [p1, p2] = match.players;
    addUnit(match, p1, MAGE, 180, 400);
    const target = addUnit(match, p2, FOOT, 180, 330); // nearest enemy, 70 away
    const nearby = addUnit(match, p2, FOOT, 210, 330); // 30 from the target
    const distant = addUnit(match, p2, FOOT, 300, 330); // 120 from the target

    stepMatch(match);
    assert.equal(target.health, FOOT.health - MAGE.damage);
    assert.equal(nearby.health, FOOT.health - MAGE.damage);
    assert.equal(distant.health, FOOT.health);
  });

  test("splash never hurts the mage's own side", () => {
    const match = newMatch();
    const [p1, p2] = match.players;
    addUnit(match, p1, MAGE, 180, 400);
    // 40 from the enemy target: inside the splash radius, outside the enemy's melee range
    const ally = addUnit(match, p1, FOOT, 220, 330);
    addUnit(match, p2, FOOT, 180, 330);

    stepMatch(match);
    assert.equal(ally.health, FOOT.health);
  });
});
