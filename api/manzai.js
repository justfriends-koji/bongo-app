export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "POST only" });
    }

    // Vercel対策：bodyが文字列/空でも読む
    let body = req.body;
    if (!body || typeof body === "string") {
      try { body = JSON.parse(body || "{}"); } catch { body = {}; }
    }

    const prompt = body?.prompt;
    if (!prompt) return res.status(400).json({ error: "prompt is required" });

    if (!process.env.GEMINI_KEY) {
      return res.status(500).json({ error: "GEMINI_KEY is not set" });
    }

    // ★ここが重要：今使えるモデルに変更（公式例）
    const MODEL = "gemini-1.5-pro";

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${process.env.GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: String(prompt) }] }]
        })
      }
    );

    const text = await r.text();
    let data;
    try { data = JSON.parse(text); }
    catch { return res.status(500).json({ error: "Non-JSON from Gemini", raw: text }); }

    // 失敗時も中身が見えるように返す
    if (!r.ok) return res.status(r.status).json(data);

    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
