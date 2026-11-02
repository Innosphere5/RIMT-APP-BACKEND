/**
 * Gemini Service — Server-side proxy for Google Gemini AI API.
 * Protects API keys from client exposure while providing
 * resume analysis and ATS scoring to the mobile app.
 */

const GEMINI_API_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_FALLBACK,
].filter(Boolean);

// Model tier cluster for failover
const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
];

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * ATS Resume Analysis System Prompt
 */
const ATS_SYSTEM_PROMPT = `You are a Chief Talent Officer and Principal Enterprise ATS Parser Architect (simulating Workday, Greenhouse, Taleo, and iCIMS parsing algorithms).

Perform an uncompromising, forensic diagnostic audit of the candidate's actual resume.
DO NOT invent fictional details. Analyze the EXACT text, structure, dates, and phrasing present in the provided document.

EVALUATION RUBRIC:
1. Machine Parseability (25%): Standard headers, parseable contact info, zero parser traps.
2. Quantification & Metric Density (25%): Concrete numbers, percentages, performance deltas.
3. Action Verb Agency (20%): High-impact technical power verbs vs passive phrases.
4. Chronological & Structural Integrity (15%): Reverse-chronological consistency, verified skills.
5. Brevity, Tone & Fluff (15%): No first-person pronouns, zero generic filler buzzwords.

Respond in valid JSON format with these fields:
{
  "atsScore": <number 0-100>,
  "overallVerdict": "<string>",
  "sectionScores": { "parseability": <0-100>, "quantification": <0-100>, "actionVerbs": <0-100>, "structure": <0-100>, "brevity": <0-100> },
  "strengths": ["<string>", ...],
  "criticalIssues": ["<string>", ...],
  "recommendations": ["<string>", ...],
  "keywordMatch": { "found": ["<string>"], "missing": ["<string>"] },
  "experienceSummary": "<string>",
  "skillsExtracted": ["<string>"]
}`;

/**
 * Call Gemini API with failover across models and API keys.
 */
async function callGeminiWithFailover(prompt, systemInstruction = ATS_SYSTEM_PROMPT) {
  const errors = [];

  for (const apiKey of GEMINI_API_KEYS) {
    for (const model of GEMINI_MODELS) {
      try {
        const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemInstruction }] },
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 4096,
              responseMimeType: 'application/json',
            },
          }),
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          errors.push(`${model}: HTTP ${response.status} - ${errText.slice(0, 200)}`);
          continue;
        }

        const result = await response.json();
        const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
          errors.push(`${model}: Empty response from Gemini`);
          continue;
        }

        // Parse JSON response
        try {
          const parsed = JSON.parse(text);
          return { success: true, data: parsed, model, source: 'gemini' };
        } catch {
          // Try to extract JSON from markdown code blocks
          const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const extracted = jsonMatch[1] || jsonMatch[0];
            return { success: true, data: JSON.parse(extracted), model, source: 'gemini' };
          }
          return { success: true, data: { rawText: text }, model, source: 'gemini' };
        }
      } catch (err) {
        errors.push(`${model}: ${err.message}`);
      }
    }
  }

  return {
    success: false,
    error: 'All Gemini API endpoints failed.',
    details: errors,
  };
}

/**
 * Analyze a resume text against a target role.
 */
async function analyzeResume(resumeText, targetRole = 'Software Engineer') {
  if (!resumeText || resumeText.trim().length < 50) {
    return {
      success: false,
      error: 'Resume text is too short for meaningful analysis (minimum 50 characters).',
    };
  }

  if (GEMINI_API_KEYS.length === 0) {
    return {
      success: false,
      error: 'Gemini API key is not configured on the server.',
    };
  }

  const prompt = `TARGET JOB ROLE: ${targetRole}

RESUME TEXT TO ANALYZE:
---
${resumeText.slice(0, 15000)}
---

Perform the complete ATS forensic audit now. Return structured JSON only.`;

  return await callGeminiWithFailover(prompt);
}

module.exports = {
  analyzeResume,
  callGeminiWithFailover,
};
