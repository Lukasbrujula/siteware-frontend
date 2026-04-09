import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getTursoClient, initTursoDb } from "../src/server/db-turso.js";

export default async function handler(
  _req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  try {
    await initTursoDb();
    const db = getTursoClient();
    const result = await db.execute("SELECT 1 as ok");
    const dbOk = result.rows.length > 0;

    res.json({
      status: "ok",
      runtime: "vercel-serverless",
      database: dbOk ? "connected" : "error",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({
      status: "error",
      runtime: "vercel-serverless",
      database: "disconnected",
      error: message,
      timestamp: new Date().toISOString(),
    });
  }
}
