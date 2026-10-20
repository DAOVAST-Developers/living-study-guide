/**
 * Direct Gemini REST API Client
 * - Zero backend / serverless
 * - Direct client-side calls with user's own API key
 * - Strictly demands JSON output with verbatim excerpts
 * - Adversarial claim checking to detect hallucinated claims or added causes
 */

export const DEFAULT_MODEL = 'gemini-2.5-flash';

export const SUPPORTED_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Recommended)' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' }
];

/**
 * Extracts concepts, flashcards, and multiple-choice questions from user notes.
 */
export async function extractStudyItemsFromNotes({ apiKey, model = DEFAULT_MODEL, notesText }) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Please configure your Gemini API Key in Settings first.');
  }
  if (!notesText || notesText.trim().length < 20) {
    throw new Error('Notes text is too short to extract study items.');
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

  const systemInstruction = `You are an elite, highly precise study guide generator and factual compiler.
Your task is to analyze the user's notes and extract key concepts, generating high-yield flashcards and 4-option multiple-choice quiz questions.

CRITICAL INVIOLABLE RULES:
1. Every generated flashcard and quiz question MUST contain a "source_excerpt" field copied WORD-FOR-WORD from the user's notes.
2. The front/back or question/answer MUST ONLY rely on facts and concepts explicitly stated in that exact source_excerpt.
3. NEVER introduce outside knowledge, causes, dates, statistics, historical context, or facts that are not in the notes.
4. Output STRICT JSON only conforming to the specified JSON schema. No conversational prose, no markdown fences.`;

  const userPrompt = `Here are the notes to analyze:

--- BEGIN NOTES ---
${notesText}
--- END NOTES ---

Generate a balanced mix of:
1. Conceptual Flashcards (front & back)
2. 4-Option Multiple Choice Quiz Questions (question, array of exactly 4 distinct options, the correct answer string exactly matching one of the options, and a brief factual explanation)

Return a JSON array of items conforming to this structure:
[
  {
    "concept": "Concept or Topic Name",
    "type": "flashcard",
    "front": "Clear, focused question or prompt",
    "back": "Accurate, concise answer drawn only from the excerpt",
    "source_excerpt": "Exact verbatim sentence or clause copied word-for-word from the notes above",
    "tags": ["tag1", "tag2"]
  },
  {
    "concept": "Concept or Topic Name",
    "type": "quiz",
    "question": "Clear multiple choice question testing understanding",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "answer": "Option A",
    "explanation": "Why this answer is correct based solely on the excerpt",
    "source_excerpt": "Exact verbatim sentence copied word-for-word from the notes above",
    "tags": ["tag1", "tag2"]
  }
]`;

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }]
      }
    ],
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },
    generationConfig: {
      temperature: 0.2, // Low temperature for high factual adherence
      responseMimeType: 'application/json'
    }
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    let errorDetail = `Status ${response.status} ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson.error && errJson.error.message) {
        errorDetail = errJson.error.message;
      }
    } catch {
      // use status text
    }
    throw new Error(`Gemini API Error: ${errorDetail}`);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('Gemini API returned an empty response.');
  }

  try {
    const parsed = JSON.parse(rawText);
    const items = Array.isArray(parsed) ? parsed : (parsed.items || parsed.cards || []);
    return items;
  } catch (err) {
    console.error('Failed to parse Gemini response as JSON:', rawText);
    throw new Error('Could not parse JSON response from Gemini. Please try again.');
  }
}

/**
 * Compares an item's content against its source_excerpt.
 * Adversarially detects if the card adds external claims, causes, or facts not in the excerpt.
 * Returns { verdict: "supported" | "adds claims", reason: string }
 */
export async function checkItemAgainstSource({ apiKey, model = DEFAULT_MODEL, item }) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Please configure your Gemini API Key in Settings first.');
  }
  if (!item || !item.source_excerpt) {
    throw new Error('Item has no source excerpt to verify against.');
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

  const cardDetails = item.type === 'quiz'
    ? `Question: ${item.question}\nOptions: ${JSON.stringify(item.options)}\nAnswer: ${item.answer}\nExplanation: ${item.explanation || ''}`
    : `Front: ${item.front}\nBack: ${item.back}`;

  const prompt = `You are a strict, adversarial fact-checking verifier for an academic study system.
Your job is to determine whether a study card stays 100% faithful to its claimed source excerpt, or whether it hallucinates or introduces external facts, causes, dates, or assumptions.

SOURCE EXCERPT:
"""${item.source_excerpt}"""

PROPOSED STUDY ITEM (${item.type}):
"""${cardDetails}"""

EVALUATION RULES:
1. If the item introduces ANY fact, historical date, external organization, causal explanation, or assertion that is NOT explicitly stated in the source excerpt, the verdict MUST be "adds claims".
2. Even if the external claim is true in the real world, if it is NOT in the excerpt, it MUST be marked "adds claims".
3. If the item only rephrases, tests, or summarizes ideas directly stated in the excerpt, the verdict MUST be "supported".

Return JSON with this exact schema:
{
  "verdict": "supported" | "adds claims",
  "reason": "Clear 1-2 sentence explanation of why it is supported or what specific claims/causes were added."
}`;

  const requestBody = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json'
    }
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    let errorDetail = `Status ${response.status} ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson.error && errJson.error.message) {
        errorDetail = errJson.error.message;
      }
    } catch {}
    throw new Error(`Gemini Check Error: ${errorDetail}`);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('Gemini verification returned an empty response.');
  }

  const result = JSON.parse(rawText);
  // Normalize verdict
  const v = (result.verdict || '').toLowerCase().includes('adds') ? 'adds claims' : 'supported';
  return {
    verdict: v,
    reason: result.reason || (v === 'supported' ? 'All claims directly supported by excerpt.' : 'Item introduces facts not present in excerpt.')
  };
}
