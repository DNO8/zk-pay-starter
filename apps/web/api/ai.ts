/** Vercel optional educational AI only. No signing, proving, note, or key custody. */
import { timingSafeEqual } from "node:crypto";
import { aiStatus, chat } from "../../api/src/openrouter";
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST")
    return res.status(405).json({ error: "POST required" });
  const expected = process.env.AI_ACCESS_TOKEN;
  if (!expected || expected.length < 32 || !aiStatus().enabled)
    return res
      .status(503)
      .json({
        error:
          "AI disabled. Configure server credentials, access token, and explicit call allowance.",
      });
  const supplied = String(req.headers.authorization ?? "").replace(
    /^Bearer /,
    "",
  );
  const a = Buffer.from(expected),
    b = Buffer.from(supplied);
  if (a.length !== b.length || !timingSafeEqual(a, b))
    return res.status(401).json({ error: "Valid AI access token required" });
  const body = req.body;
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length
  )
    return res
      .status(400)
      .json({
        error: "Only an empty JSON object is accepted; never send payment data",
      });
  try {
    return res.status(200).json(await chat());
  } catch {
    return res
      .status(502)
      .json({ error: "AI request failed; no payment data was sent" });
  }
}
