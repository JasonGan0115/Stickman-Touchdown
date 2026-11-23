import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

// One shared client for the whole server process (it manages a connection pool)
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
export const prisma = new PrismaClient({ adapter });

/** One-line summary of a (often multi-line) Prisma/driver error, for logs. */
export function errorSummary(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const code = (err as { code?: unknown }).code;
  const lines = err.message.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const last = lines.at(-1) ?? err.name;
  return typeof code === "string" && !last.includes(code) ? `${code}: ${last}` : last;
}
