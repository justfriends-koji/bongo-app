export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "POST only" });
    }

    // Vercel対策：bodyがstring/undefinedでも読む
    let body = req.body;
    if (!body || typeof body === "string") {
      try { body = JSON.parse(body || "{}"); } catch { body = {}; }
    }

    const prompt = body?.prompt;
    if (!prompt) return res.status(400).json({ error: "prompt is required" });

    const key = process.env.GEMINI_KEY;
    if (!key) return res.status(500).json({ error: "GEMINI_KEY is not set" });

    // まず v1beta を試し、ダメなら v1 へ自動フォールバック
    const result = await generateWithAutoModel({ apiKey: key, prompt: String(prompt) });
    return res.status(200).json(result);

  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}

// --------------------------
// ここから下はユーティリティ
// --------------------------

async function generateWithAutoModel({ apiKey, prompt }) {
  // 1) v1beta で listModels → generateContent 対応モデルを選ぶ → generate
  const v1betaTry = await tryGenerateOnce({ apiKey, prompt, apiVersion: "v1beta" });
  if (v1betaTry.ok) return v1betaTry.data;

  // 2) v1 で listModels → generateContent 対応モデルを選ぶ → generate
  const v1Try = await tryGenerateOnce({ apiKey, prompt, apiVersion: "v1" });
  if (v1Try.ok) return v1Try.data;

  // どっちもダメなら、原因が分かるように両方返す
  return {
    error: "generate failed on both v1beta and v1",
    v1beta: v1betaTry.error,
    v1: v1Try.error
  };
}

async function tryGenerateOnce({ apiKey, prompt, apiVersion }) {
  try {
    const models = await listModels({ apiKey, apiVersion });

    // generateContent 対応モデルだけに絞る
    // 返ってくる形式は環境差があるのでできるだけ堅牢に
    const candidates = (models || [])
      .filter(m => {
        const methods = m?.supportedGenerationMethods;
        return Array.isArray(methods) && methods.includes("generateContent");
      })
      .map(m => m?.name)
      .filter(name => typeof name === "string" && name.startsWith("models/"));

    if (!candidates.length) {
      return {
        ok: false,
        error: { apiVersion, message: "No generateContent-capable models found", rawModelsCount: (models || []).length }
      };
    }

    // 優先順位（推測ではなく、存在する候補の中から選ぶ）
    // - flash系を優先（速い）
    // - 次に pro
    // - それ以外
    const pick =
      candidates.find(n => /flash/i.test(n)) ||
      candidates.find(n => /pro/i.test(n)) ||
      candidates[0];

    const gen = await generateContent({ apiKey, apiVersion, modelName: pick, prompt });

    if (!gen.ok) {
      return { ok: false, error: { apiVersion, model: pick, ...gen.error } };
    }

    return { ok: true, data: gen.data };

  } catch (e) {
    return { ok: false, error: { apiVersion, message: String(e?.message || e) } };
  }
}

async function listModels({ apiKey, apiVersion }) {
  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models?key=${encodeURIComponent(apiKey)}`;
  const r = await fetch(url, { method: "GET" });
  const text = await r.text();

  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  // 失敗でも解析用に投げず、空配列にする
  const models = Array.isArray(data?.models) ? data.models : [];
  return models;
}

async function generateContent({ apiKey, apiVersion, modelName, prompt }) {
  const url = `https://generativelanguage.googleapis.com/${apiVersion}/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!r.ok) {
    return {
      ok: false,
      error: {
        httpStatus: r.status,
        httpStatusText: r.statusText,
        apiError: data?.error || data
      }
    };
  }

  return { ok: true, data };
}
