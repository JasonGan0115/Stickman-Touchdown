import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { AUGMENTS, combineAugments, describeModifiers, getDraftOptions, NO_MODIFIERS } from "./augments";
import {
  AUGMENT_DURATION_MS,
  ENDZONE_DEPTH,
  FIELD_HEIGHT,
  MANA_PER_SECOND,
  MAX_MANA,
  OVERTIME_MANA_MULTIPLIER,
  SPAWN_COOLDOWN_TICKS,
  TICK_RATE,
  WINNING_SCORE,
} from "./constants";
import {
  addUnit,
  applyAugment,
  createMatch,
  getScoreLimitWinner,
  isInDefensiveZone,
  stepMatch,
  trySpawn,
  type Match,
} from "./match";
import { pruneLoadout } from "../players";
import { DEFAULT_HAND, sampleRandomCards, TOWER_STATS, UNIT_STATS } from "./units";

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
    assert.deepEqual(match.players[0].hand, DEFAULT_HAND.slice(0, 4));
    assert.deepEqual(match.players[0].drawQueue, DEFAULT_HAND.slice(4));
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
    p1.spawnCooldownTicks = 0;
    const result = trySpawn(match, p1, MAGE.cardId, 100, P1_HOME_Y);
    assert.ok(result.ok);
    assert.equal(p1.mana, MAX_MANA - MAGE.cost);
    assert.equal(result.entity.type, "Caster");
    assert.equal(result.entity.health, MAGE.health);
    assert.equal(result.entity.damage, MAGE.damage);
  });

  test("enforces 2-second placement cooldown", () => {
    const match = newMatch();
    const p1 = match.players[0];
    p1.mana = MAX_MANA;
    const first = trySpawn(match, p1, p1.hand[0], 100, P1_HOME_Y);
    assert.ok(first.ok);
    const second = trySpawn(match, p1, p1.hand[0], 100, P1_HOME_Y);
    assert.equal(second.ok, false);
    if (!second.ok) assert.equal(second.reason, "cooldown_active");
  });

  test("cycles the spawned card to the draw queue and draws the next card", () => {
    const match = newMatch();
    const p1 = match.players[0];
    p1.mana = MAX_MANA;
    const playedCard = p1.hand[0];
    const nextExpected = p1.drawQueue[0];
    const result = trySpawn(match, p1, playedCard, 100, P1_HOME_Y);
    assert.ok(result.ok);
    assert.equal(p1.hand[0], nextExpected);
    assert.equal(p1.drawQueue.at(-1), playedCard);
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

  test("ground melee and tank units cannot target flying aerial units, while ranged and caster can", () => {
    const match = newMatch();
    const [p1, p2] = match.players;
    const bat = UNIT_STATS.card_bat_flyer;
    const tank = UNIT_STATS.card_shield_bearer;
    addUnit(match, p1, FOOT, 180, 300); // ground melee
    addUnit(match, p1, tank, 180, 305); // ground tank
    addUnit(match, p1, ARCHER, 180, 310); // ranged (air + ground)
    addUnit(match, p1, MAGE, 180, 310); // caster (air + ground)
    addUnit(match, p2, bat, 180, 320); // flying enemy right next to them
    stepMatch(match);
    const groundFoot = match.entities.find((e) => e.cardId === FOOT.cardId);
    const groundTank = match.entities.find((e) => e.cardId === tank.cardId);
    const ranged = match.entities.find((e) => e.cardId === ARCHER.cardId);
    const caster = match.entities.find((e) => e.cardId === MAGE.cardId);
    assert.equal(groundFoot?.state, "moving", "ground melee cannot lock onto flying");
    assert.equal(groundTank?.state, "moving", "ground tank cannot lock onto flying");
    assert.equal(ranged?.state, "attacking", "ranged can target flying");
    assert.equal(caster?.state, "attacking", "caster can target flying");
  });

  test("scoring a touchdown resets the field with 5 sticky liquid", () => {
    const match = newMatch();
    const [p1, p2] = match.players;
    p1.mana = 1;
    p2.mana = 1;
    // P1 attacks up the field (y decreases). Endzone is <= ENDZONE_DEPTH (96).
    // Placing at 96 + FOOT.speed ensures it reaches the endzone in 1 tick.
    addUnit(match, p1, FOOT, 180, 96 + FOOT.speed);
    const events = stepMatch(match);
    assert.equal(events.scored.length, 1);
    assert.equal(events.roundReset, true);
    assert.equal(p1.score, 1);
    assert.equal(match.entities.length, 0, "field cleared on touchdown");
    assert.equal(p1.mana, 5, "scorer liquid set to 5");
    assert.equal(p2.mana, 5, "defender liquid set to 5");
    assert.equal(p1.spawnCooldownTicks, SPAWN_COOLDOWN_TICKS, "scorer spawn cooldown reset to 1s");
    assert.equal(p2.spawnCooldownTicks, SPAWN_COOLDOWN_TICKS, "defender spawn cooldown reset to 1s");
  });

  test("first player to 3 touchdowns wins the match immediately", () => {
    const match = newMatch();
    const [p1] = match.players;
    p1.score = WINNING_SCORE - 1;
    assert.equal(getScoreLimitWinner(match), undefined);
    addUnit(match, p1, FOOT, 180, 96 + FOOT.speed);
    const events = stepMatch(match);
    assert.equal(p1.score, WINNING_SCORE);
    assert.equal(events.roundReset, false);
    assert.equal(match.entities.length, 0, "field cleared on winning touchdown");
    assert.equal(getScoreLimitWinner(match)?.id, p1.id);
  });

  test("only 1 point is awarded per round even if multiple units cross the endzone on the same tick", () => {
    const match = newMatch();
    const [p1] = match.players;
    addUnit(match, p1, FOOT, 120, 96 + FOOT.speed);
    addUnit(match, p1, FOOT, 240, 96 + FOOT.speed);
    const events = stepMatch(match);
    assert.equal(p1.score, 1);
    assert.equal(events.scored.length, 1);
    assert.equal(events.roundReset, true);
    assert.equal(match.entities.length, 0);
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
    assert.ok(Math.abs(boosted.mana - (3 + MANA_PER_SECOND * 1.2)) < 1e-9);
    assert.ok(Math.abs(normal.mana - (3 + MANA_PER_SECOND)) < 1e-9);
  });
});

describe("draft and scouting", () => {
  test("sampleRandomCards returns unique random cards from deck", () => {
    const deck = ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"];
    const sampled = sampleRandomCards(deck, 4);
    assert.equal(sampled.length, 4);
    assert.equal(new Set(sampled).size, 4);
    for (const c of sampled) assert.ok(deck.includes(c));
  });

  test("getDraftOptions silver returns 3 Common augments", () => {
    const options = getDraftOptions("silver", 3);
    assert.equal(options.length, 3);
    assert.equal(new Set(options.map((o) => o.id)).size, 3);
    for (const o of options) {
      assert.equal(o.rarity, "Common");
      assert.ok(o.effect.length > 0);
    }
  });

  test("getDraftOptions gold, epic, legendary, and gold_or_legendary return matching rarities", () => {
    const gold = getDraftOptions("gold", 3);
    assert.equal(gold.length, 3);
    for (const o of gold) assert.equal(o.rarity, "Rare");

    const epic = getDraftOptions("epic", 3);
    assert.equal(epic.length, 3);
    for (const o of epic) assert.equal(o.rarity, "Epic");

    const legendary = getDraftOptions("legendary", 3);
    assert.equal(legendary.length, 3);
    for (const o of legendary) assert.equal(o.rarity, "Legendary");

    const options = getDraftOptions("gold_or_legendary", 3);
    assert.equal(options.length, 3);
    assert.equal(new Set(options.map((o) => o.id)).size, 3);
    for (const o of options) {
      assert.ok(o.rarity === "Rare" || o.rarity === "Legendary");
      assert.ok(o.effect.length > 0);
    }
  });

  test("applyAugment mid-match updates loadout and modifiers immediately", () => {
    const match = newMatch();
    const p1 = match.players[0];
    assert.equal(p1.modifiers.health, 1);
    applyAugment(p1, "aug_iron_skin"); // +10% health
    assert.ok(p1.loadout.augmentIds.includes("aug_iron_skin"));
    assert.ok(Math.abs(p1.modifiers.health - 1.1) < 1e-9);
  });

  test("augment catalog has unique augments across Common, Rare, Epic, and Legendary", () => {
    const all = Object.values(AUGMENTS);
    assert.equal(all.length, 112);
    assert.equal(new Set(all.map((a) => a.id)).size, 112);
    assert.equal(new Set(all.map((a) => a.name)).size, 112);
    assert.ok(all.some((a) => a.rarity === "Common"));
    assert.ok(all.some((a) => a.rarity === "Rare"));
    assert.ok(all.some((a) => a.rarity === "Epic"));
    assert.ok(all.some((a) => a.rarity === "Legendary"));
    for (const a of all) assert.ok(a.modifier > 1);
  });

  test("augments expire after 24 hours and pruneLoadout drops expired or excess grants", () => {
    assert.equal(AUGMENT_DURATION_MS, 24 * 60 * 60 * 1000);
    const pruned = pruneLoadout(
      {
        unitIds: ["card_footsoldier", "card_unowned"],
        augmentIds: ["aug_iron_skin", "aug_iron_skin", "aug_expired"],
      },
      new Set(["card_footsoldier"]),
      new Map([["aug_iron_skin", 1]]),
    );
    assert.deepEqual(pruned.unitIds, ["card_footsoldier"]);
    assert.deepEqual(pruned.augmentIds, ["aug_iron_skin"]);
  });
});

describe("tactical spells", () => {
  test("spells can be cast anywhere on the field and never score", () => {
    const match = newMatch(["card_sticky_bomb", "card_zap_shock", "card_glue_freeze", "card_footsoldier"]);
    const [p1] = match.players;
    p1.mana = 10;

    // Cast Sticky Bomb directly inside opponent's endzone (y = 20)
    const res = trySpawn(match, p1, "card_sticky_bomb", 180, 20);
    assert.equal(res.ok, true);
    if (res.ok) assert.equal(res.isSpell, true);
    assert.equal(match.entities.length, 0, "spells do not spawn Entity units");
    const events = stepMatch(match);
    assert.equal(events.scored.length, 0);
    assert.equal(p1.score, 0);
  });

  test("zap shock stuns enemies and glue freeze slows + clamps y outside endzones", () => {
    const match = newMatch(["card_zap_shock", "card_glue_freeze", "card_footsoldier", "card_archer"]);
    const [p1, p2] = match.players;
    p1.mana = 10;

    const enemy = addUnit(match, p2, FOOT, 180, ENDZONE_DEPTH + 2);
    const startY = enemy.y;
    const zap = trySpawn(match, p1, "card_zap_shock", 180, startY);
    assert.equal(zap.ok, true);
    stepMatch(match);
    assert.equal(enemy.y, startY, "stunned unit does not move");

    // Advance past stun duration, then cast Glue Freeze near top endzone (within 85px radius)
    match.tick += TICK_RATE * 2;
    p1.spawnCooldownTicks = 0;
    const freeze = trySpawn(match, p1, "card_glue_freeze", 180, 20);
    assert.equal(freeze.ok, true);
    assert.ok(enemy.y >= ENDZONE_DEPTH + 1, "pull is clamped outside P2 endzone");
    const yBeforeSlowStep = enemy.y;
    stepMatch(match);
    const moved = enemy.y - yBeforeSlowStep;
    assert.ok(moved > 0 && moved < FOOT.speed, "slowed unit moves slower than normal speed");
  });
});

describe("deployable defensive towers", () => {
  test("towers require defensive quarter-zone placement", () => {
    const match = newMatch(["card_magnet_tower", "card_glue_cannon", "card_footsoldier", "card_archer"]);
    const [p1] = match.players;
    p1.mana = 10;

    assert.equal(isInDefensiveZone(1, FIELD_HEIGHT * 0.5), false);
    assert.equal(isInDefensiveZone(1, FIELD_HEIGHT * 0.72), true);

    const bad = trySpawn(match, p1, "card_magnet_tower", 180, FIELD_HEIGHT * 0.5);
    assert.deepEqual(bad, { ok: false, reason: "outside_defensive_zone" });

    const good = trySpawn(match, p1, "card_magnet_tower", 180, FIELD_HEIGHT * 0.72);
    assert.equal(good.ok, true);
  });

  test("towers never move, never score, decay HP each tick, and clear on roundReset", () => {
    const match = newMatch(["card_magnet_tower", "card_footsoldier", "card_archer", "card_shield_bearer"]);
    const [p1, p2] = match.players;
    p1.mana = 10;

    const res = trySpawn(match, p1, "card_magnet_tower", 180, FIELD_HEIGHT * 0.72);
    assert.equal(res.ok, true);
    assert.ok(res.ok && !res.isSpell);
    if (!res.ok || res.isSpell) return;
    const tower = res.entity;
    const startY = tower.y;
    const startHp = tower.health;

    stepMatch(match);
    assert.equal(tower.y, startY, "tower does not move");
    assert.equal(p1.score, 0, "tower never scores");
    assert.ok(
      Math.abs(tower.health - (startHp - TOWER_STATS.card_magnet_tower.health / TOWER_STATS.card_magnet_tower.lifetimeTicks)) < 1e-6,
      "tower decays HP each tick",
    );

    // Opponent scores on the far side (outside Magnet Tower's 135px taunt radius) -> roundReset clears tower
    addUnit(match, p2, FOOT, 20, FIELD_HEIGHT - ENDZONE_DEPTH - FOOT.speed);
    const events = stepMatch(match);
    assert.equal(events.roundReset, true);
    assert.equal(match.entities.length, 0, "tower cleared on touchdown roundReset");
  });
});

describe("sudden-death overtime", () => {
  test("overtime boosts mana regen and next touchdown wins immediately without roundReset", () => {
    const match = newMatch();
    const [p1, p2] = match.players;
    p1.score = 1;
    p2.score = 1;
    match.overtime = true;

    // Still tied -> no winner yet (draw if clock expires)
    assert.equal(getScoreLimitWinner(match), undefined);

    const manaBefore = p1.mana;
    steps(match, TICK_RATE);
    assert.ok(
      Math.abs(p1.mana - (manaBefore + MANA_PER_SECOND * OVERTIME_MANA_MULTIPLIER)) < 1e-9,
      "1.5x mana regen in overtime",
    );

    // Next TD wins immediately and skips roundReset/comeback draft
    addUnit(match, p1, FOOT, 180, ENDZONE_DEPTH + FOOT.speed);
    const events = stepMatch(match);
    assert.equal(events.scored.length, 1);
    assert.equal(events.roundReset, false);
    assert.equal(getScoreLimitWinner(match)?.id, p1.id);
  });
});
