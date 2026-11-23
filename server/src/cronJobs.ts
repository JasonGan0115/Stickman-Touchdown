import cron, { type ScheduledTask } from "node-cron";
import { prisma } from "./db";

// Every day at 00:00, in the server's local timezone
const MIDNIGHT_DAILY = "0 0 * * *";

/** Deletes every PlayerAugment whose expiresAt is in the past. Returns how many rows were removed. */
export async function purgeExpiredAugments(): Promise<number> {
  const { count } = await prisma.playerAugment.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return count;
}

/** Starts all background cron jobs. Call once at server startup; returns the tasks so they can be stopped on shutdown. */
export function initCronJobs(): ScheduledTask[] {
  const purgeTask = cron.schedule(
    MIDNIGHT_DAILY,
    async () => {
      try {
        const count = await purgeExpiredAugments();
        console.log(`[cron] purge-expired-augments: deleted ${count} expired augment(s)`);
      } catch (err) {
        // Log and carry on: one failed run (e.g. DB briefly down) must not crash the game server
        console.error("[cron] purge-expired-augments failed:", err);
      }
    },
    { name: "purge-expired-augments", noOverlap: true },
  );

  console.log(`[cron] scheduled purge-expired-augments (${MIDNIGHT_DAILY}, server local time)`);
  return [purgeTask];
}
