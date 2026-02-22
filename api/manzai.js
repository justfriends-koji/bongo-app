export default async function handler(req, res) {

try {

if (req.method !== "POST") {
return res.status(405).json({ error: "POST only" });
}

// bodyを確実に読む（Vercel対策）
let body = req.body;
if (!body || typeof body === "string") {
try { body = JSON.parse(body || "{}"); }
catch { body = {}; }
}

const prompt = body.prompt;
if (!prompt) {
return res.status(400).json({ error: "prompt missing" });
}

// ★ここが最新版モデル（重要）
const MODEL = "gemini-1.5-flash";

// Gemini API呼び出し
const r = await fetch(
`https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent?key=${process.env.GEMINI_KEY}`,
{
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
contents: [{ parts: [{ text: prompt }] }]
})
}
);

// JSON安全取得
const text = await r.text();
let data;
try { data = JSON.parse(text); }
catch {
return res.status(500).json({ error: "Gemini returned non-JSON", raw:text });
}

return res.status(200).json(data);

} catch (e) {

console.log("ERROR:", e);
return res.status(500).json({ error:String(e) });

}

}
