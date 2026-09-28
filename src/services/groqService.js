const config = require('../config');
const { AppError } = require('../utils/response');

const SYSTEM = `You are a clinical decision-SUPPORT assistant for a healthcare worker in a maternal care clinic.
You receive a prototype ML triage score and recorded data. Rules:
- Do NOT diagnose. Do NOT prescribe or name medications, doses or treatments.
- Use ONLY the data provided. If something is missing, say it is not recorded. Never invent values.
- The score is a prototype ML triage score, not a diagnosis. Say the healthcare worker makes all decisions.
- Be concise (under 250 words). Use exactly these numbered headings:
1. Risk summary
2. Key factors
3. Suggested monitoring
4. Suggested follow-up
5. Priority
6. Suggested next step for healthcare-worker consideration`;

async function generateRecommendation(context) {
  if (!config.groqApiKey) throw new AppError(503, 'GROQ_API_KEY is not configured on the server');
  let res;
  try {
    res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.groqApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.groqModel, temperature: 0.2, max_tokens: 700,
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: JSON.stringify(context, null, 1) }],
      }),
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new AppError(503, 'Could not reach the Groq API');
  }
  if (!res.ok) throw new AppError(502, `Groq API error (${res.status})`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new AppError(502, 'Groq returned an empty response');
  return text;
}
module.exports = { generateRecommendation };
