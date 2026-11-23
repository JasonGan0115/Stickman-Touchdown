import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { botTick, createBot, seededRng } from "./bot";
import { FIELD_HEIGHT, MATCH_DURATION_MS, MAX_MANA, TICK_MS, TICK_RATE } from "./constants";
import { addUnit, createMatch, getScoreLimitWinner, isInHomeEndzone, stepMatch, type Match } from "./match";
import { UNIT_STATS } from "./units";

function newMatch(p1Units: string[] = []): Match {
  return createMatch(
    "bot-test",
    "standard",
    { id: "bot1", username: "Bot1", loadout: { unitIds: p1Units, augmentIds: [] } },
    { id: "bot2", username: "Bot2", loadout: { unitIds: [], augmentIds: [] } },
  );
}

/** Advances to the bot's next think and runs it. */
function think(match: Match, bot = createBot(), rng = seededRng(1)) {
  match.tick = bot.nextThinkTick;
  return botTick(match, match.players[0], bot, rng);
}

describe("bot", () => {
  test("does nothing without mana", () => {
    const match = newMatch();
    match.players[0].mana = 0;
    assert.equal(think(match), null);
    assert.equal(match.entities.length, 0);
  });

  test("defends the lane of an enemy closing in on its endzone", () => {
    const match = newMatch();
    const [bot, enemy] = match.players;
    bot.mana = MAX_MANA;
    addUnit(match, enemy, UNIT_STATS.card_footsoldier, 300, FIELD_HEIGHT - 200);

    const unit = think(match);
    assert.ok(unit, "it spawned a defender");
    assert.equal(unit.cardId, "card_shield_bearer");
    assert.ok(Math.abs(unit.x - 300) <= 20, `spawned in the enemy's lane (x ${unit.x})`);
    assert.ok(isInHomeEndzone(1, unit.y));
  });

  test("answers a tank with an archer", () => {
    const match = newMatch();
    const [bot, enemy] = match.players;
    bot.mana = MAX_MANA;
    addUnit(match, enemy, UNIT_STATS.card_shield_bearer, 180, FIELD_HEIGHT - 250);
    assert.equal(think(match)?.cardId, "card_archer");
  });

  test("only plays cards from its hand", () => {
    const match = newMatch(["card_footsoldier"]);
    const [bot, enemy] = match.players;
    bot.mana = MAX_MANA;
    addUnit(match, enemy, UNIT_STATS.card_shield_bearer, 180, FIELD_HEIGHT - 250);
    assert.equal(think(match)?.cardId, "card_footsoldier");
  });

  test("a push is a tank followed by an archer in the same lane", () => {
    const match = newMatch();
    const bot = createBot();
    const rng = seededRng(7);
    match.players[0].mana = MAX_MANA;

    const tank = think(match, bot, rng);
    assert.equal(tank?.cardId, "card_shield_bearer");
    const archer = think(match, bot, rng);
    assert.equal(archer?.cardId, "card_archer");
    assert.ok(Math.abs(archer.x - tank.x) <= 30);
  });

  test("two bots play a full match without breaking any rules", () => {
    const match = newMatch();
    const bots = [createBot(), createBot()];
    const rng = seededRng(42);
    const maxTicks = Math.ceil(MATCH_DURATION_MS / TICK_MS);
    let spawned = 0;

    for (let t = 0; t < maxTicks && !getScoreLimitWinner(match); t++) {
      match.tick++;
      match.players.forEach((p, i) => {
        if (botTick(match, p, bots[i], rng)) spawned++;
      });
      stepMatch(match);
      for (const p of match.players) assert.ok(p.mana >= 0, "mana never goes negative");
    }

    const [p1, p2] = match.players;
    assert.ok(spawned >= 10, `both bots keep playing (${spawned} units)`);
    assert.ok(p1.score + p2.score > 0, "somebody scores");
    assert.ok(match.tick > TICK_RATE * 10, "the match lasts more than a few seconds");
  });
});
