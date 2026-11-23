import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { combineAugments, describeModifiers, NO_MODIFIERS } from "./augments";
import { FIELD_HEIGHT, MAX_MANA, TICK_RATE } from "./constants";
import { addUnit, createMatch, stepMatch, trySpawn, type Match } from "./match";
import { DEFAULT_HAND, UNIT_STATS } from "./units";

const FOOT = UNIT_STATS.card_footsoldier;
const ARCHER = UNIT_STATS.card_archer;
const MAGE = UNIT_STATS.card_battle_mage;

const P1_HOME_Y = FIELD_HEIGHT - 20; // inside Player 1's endzone (bottom)

function newMatch(p1Units: string[] = [], p2Units: string[] = [], p1Augments: string[] = []): Match {
  return createMatch(
    "test",
    "standard",
    { id: "p1", username: "one", loadout: { unitIds: p1Units, augmentIds: p1Augments } },
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

describe("augments", () => {
  const withAugments = (...ids: string[]) => newMatch([], [], ids);

  test("no augments means no change", () => {
    assert.deepEqual(newMatch().players[0].modifiers, NO_MODIFIERS);
  });

  test("boosts to the same stat stack by multiplying; unknown ids are ignored", () => {
    const mods = combineAugments(["aug_iron_skin", "aug_titans_blessing", "aug_not_real"]);
    assert.ok(Math.abs(mods.health - 1.1 * 1.5) < 1e-9);
    assert.equal(mods.damage, 1);
    assert.deepEqual(describeModifiers(mods), ["+65% unit health"]);
  });

  test("health and damage boosts apply to units at spawn, and only for their owner", () => {
    const match = withAugments("aug_iron_skin", "aug_berserker_rage");
    const [p1, p2] = match.players;
    const mine = addUnit(match, p1, FOOT, 100, 600);
    const theirs = addUnit(match, p2, FOOT, 300, 40);
    assert.equal(mine.health, Math.round(FOOT.health * 1.1));
    assert.equal(mine.maxHealth, mine.health);
    assert.equal(mine.damage, Math.round(FOOT.damage * 1.25));
    assert.equal(theirs.health, FOOT.health);
    assert.equal(theirs.damage, FOOT.damage);
  });

  test("attack speed shortens the time between hits", () => {
    const match = withAugments("aug_phoenix_heart");
    const unit = addUnit(match, match.players[0], FOOT, 100, 600);
    assert.equal(unit.attackIntervalTicks, Math.round(FOOT.attackIntervalTicks / 1.4));
    assert.ok(unit.attackIntervalTicks < FOOT.attackIntervalTicks);
  });

  test("move speed and range boosts apply", () => {
    const match = withAugments("aug_swift_boots", "aug_eagle_eye");
    const unit = addUnit(match, match.players[0], ARCHER, 100, 600);
    assert.equal(unit.speed, ARCHER.speed * 1.05);
    assert.equal(unit.attackRange, ARCHER.attackRange * 1.15);
  });

  test("a range boost lets an archer engage an enemy just past normal range", () => {
    const match = withAugments("aug_eagle_eye");
    const [p1, p2] = match.players;
    const archer = addUnit(match, p1, ARCHER, 180, 500);
    addUnit(match, p2, FOOT, 180, 500 - (ARCHER.attackRange + 10)); // 140 away; boosted range is ~150
    stepMatch(match);
    assert.equal(archer.state, "attacking");
  });

  test("mana regen boost fills mana faster", () => {
    const match = withAugments("aug_mana_surge");
    steps(match, TICK_RATE); // one second
    const [boosted, normal] = match.players;
    assert.ok(Math.abs(boosted.mana - 1.2) < 1e-9);
    assert.ok(Math.abs(normal.mana - 1) < 1e-9);
  });
});
