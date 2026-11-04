import { timingSafeEqual } from "node:crypto";
import { expireLicenses } from "@/lib/service";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32)
    return Response.json(
      { error: "Scheduler not configured" },
      { status: 503 },
    );
  const expected = Buffer.from(`Bearer ${secret}`),
    actual = Buffer.from(request.headers.get("authorization") || "");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  let expired = 0,
    notified = 0,
    batches = 0,
    batchSize = 500;
  const deadline = Date.now() + 35000;
  while (batchSize === 500 && Date.now() < deadline) {
    const result = await expireLicenses();
    expired += result.expired;
    notified += result.notified;
    batchSize = result.batchSize;
    batches++;
  }
  return Response.json(
    { expired, notified, batches, remaining: batchSize === 500 },
    { headers: { "Cache-Control": "no-store" } },
  );
}
