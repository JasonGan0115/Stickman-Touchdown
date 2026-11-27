import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { getAIBonus } from "./ai";
import { botTick, createBot, seededRng } from "./bot";
import { LOADOUT_AUGMENT_SLOTS, LOADOUT_UNIT_SLOTS, MATCH_DURATION_MS, STARTING_MANA, TICK_MS } from "./constants";
import { createMatch, getScoreLimitWinner, stepMatch } from "./match";
import { getIsoWeekKey, getWeeklyTournamentLoadout } from "./tournament";
import { DEFAULT_HAND } from "./units";

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

  test("simulated vs-AI curve matches beginner (1-10), ~20/80 (50), and harder endgame (100)", () => {
    const simWinRate = (level: number, matches: number): number => {
      const rng = seededRng(20261126 + level * 77);
      const maxTicks = Math.ceil(MATCH_DURATION_MS / TICK_MS);
      let playerScore = 0;

      for (let m = 0; m < matches; m++) {
        const match = createMatch(
          `vs_${level}_${m}`,
          "standard",
          { id: "player", username: "Player", loadout: { unitIds: DEFAULT_HAND, augmentIds: [] } },
          { id: "ai", username: `AI_${level}`, loadout: { unitIds: DEFAULT_HAND, augmentIds: [] } },
        );
        const bonus = getAIBonus(level);
        const [humanPlayer, botPlayer] = match.players;
        botPlayer.mana = bonus.startingLiquid;
        botPlayer.modifiers.manaRegen *= bonus.manaRegenMultiplier;
        humanPlayer.modifiers.damage *= 1 - bonus.damageDebuff;

        const playerBot = createBot();
        const aiBot = createBot(level);

        for (let t = 0; t < maxTicks && !getScoreLimitWinner(match); t++) {
          match.tick++;
          botTick(match, humanPlayer, playerBot, rng);
          botTick(match, botPlayer, aiBot, rng);
          stepMatch(match);
        }

        const winner =
          getScoreLimitWinner(match) ??
          (humanPlayer.score > botPlayer.score ? humanPlayer : botPlayer.score > humanPlayer.score ? botPlayer : null);
        if (!winner) playerScore += 0.5;
        else if (winner.id === "player") playerScore += 1;
      }
      return playerScore / matches;
    };

    const lv5WinRate = simWinRate(5, 60);
    const lv30WinRate = simWinRate(30, 60);
    const lv50WinRate = simWinRate(50, 80);
    const lv100WinRate = simWinRate(100, 60);

    assert.ok(lv5WinRate >= 0.75, `expected Lv.5 player win rate >= 0.75, got ${lv5WinRate.toFixed(3)}`);
    assert.ok(lv5WinRate > lv30WinRate && lv30WinRate > lv50WinRate, "win rate decreases monotonically from Lv.5 -> 30 -> 50");
    assert.ok(lv50WinRate >= 0.1 && lv50WinRate <= 0.3, `expected Lv.50 player win rate near 0.20, got ${lv50WinRate.toFixed(3)}`);
    assert.ok(lv100WinRate < lv50WinRate, `expected Lv.100 (${lv100WinRate.toFixed(3)}) harder than Lv.50 (${lv50WinRate.toFixed(3)})`);
  });
});
