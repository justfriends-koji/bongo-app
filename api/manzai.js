export default async function handler(req, res) {
  try {
    // Vercel Functions: body は JSON で来る想定
    const { prompt } = req.body || {};

    if (!process.env.GEMINI_KEY) {
      return res.status(500).json({ error: "GEMINI_KEY is not set" });
    }
    if (!prompt) {
      return res.status(400).json({ error: "prompt is required" });
    }

    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
        process.env.GEMINI_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: String(prompt) }] }]
        })
      }
    );

    const data = await r.json();
    return res.status(r.status).json(data);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
