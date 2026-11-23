import { Router } from "express";
import { errorSummary } from "../db";
import { getCollection, LoadoutError, saveLoadout, USERNAME_PATTERN } from "../players";

export const playerRouter = Router();

function dbError(res: import("express").Response, err: unknown) {
  console.error("[player] database error:", errorSummary(err));
  res.status(503).json({ ok: false, error: "Database unavailable" });
}

/** GET /player/:username/collection — unlocked cards, active augments, saved loadout */
playerRouter.get("/:username/collection", async (req, res) => {
  const { username } = req.params;
  if (!USERNAME_PATTERN.test(username)) {
    res.status(400).json({ ok: false, error: "Invalid username" });
    return;
  }
  try {
    res.json({ ok: true, ...(await getCollection(username)) });
  } catch (err) {
    dbError(res, err);
  }
});

/** POST /player/loadout — body: { username, unitIds: string[], augmentIds: string[] } */
playerRouter.post("/loadout", async (req, res) => {
  const { username, unitIds, augmentIds } = req.body ?? {};
  if (typeof username !== "string" || !USERNAME_PATTERN.test(username)) {
    res.status(400).json({ ok: false, error: "Invalid username" });
    return;
  }
  try {
    const loadout = await saveLoadout(username, unitIds, augmentIds);
    console.log(`[player] ${username} saved loadout: units [${loadout.unitIds.join(", ")}] augments [${loadout.augmentIds.join(", ")}]`);
    res.json({ ok: true, loadout });
  } catch (err) {
    if (err instanceof LoadoutError) {
      res.status(400).json({ ok: false, error: err.message });
      return;
    }
    dbError(res, err);
  }
});
