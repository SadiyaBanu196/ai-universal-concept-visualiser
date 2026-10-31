/**
 * Safe JSON Extraction and Normalization Utility
 * Extracts and parses structured JSON from AI responses that may contain
 * markdown code fences, mathematical backslashes (LaTeX), unescaped control characters,
 * or surrounding text without corrupting valid escapes or expressions.
 */

export function extractAndParseJson<T = any>(rawText: string | null | undefined): {
  success: boolean;
  data: T | null;
  error?: string;
} {
  if (!rawText || typeof rawText !== 'string') {
    return { success: false, data: null, error: 'Empty or non-string response received from AI.' };
  }

  let cleaned = rawText.trim();

  // 1. Remove markdown code fences if present (```json ... ``` or ``` ...)
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
  cleaned = cleaned.replace(/\s*```$/i, '');
  cleaned = cleaned.trim();

  // 2. Extract outermost JSON object if surrounding commentary exists
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  // 3. First attempt: Standard direct JSON.parse
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object') {
      return { success: true, data: parsed };
    }
  } catch (firstErr) {
    // Continue to robust sanitizer
  }

  // 4. Second attempt: Sanitize string literals inside JSON
  // Fix bad escapes (like LaTeX \alpha, \cos, \sin, \theta, \frac, \Delta, etc.)
  // and unescaped raw newlines/tabs inside JSON string literals
  try {
    const sanitized = sanitizeJsonStringLiterals(cleaned);
    const parsed = JSON.parse(sanitized);
    if (parsed && typeof parsed === 'object') {
      return { success: true, data: parsed };
    }
  } catch (secondErr: any) {
    return {
      success: false,
      data: null,
      error: `JSON parse error: ${secondErr.message || 'Malformed JSON structure'}`,
    };
  }

  return { success: false, data: null, error: 'Unable to parse valid JSON object.' };
}

/**
 * Scans JSON character by character and escapes invalid single backslashes
 * (such as mathematical symbols \theta, \sin, \cos, \vec) and unescaped control characters
 * only within string literals.
 */
export function sanitizeJsonStringLiterals(jsonStr: string): string {
  let result = '';
  let inString = false;
  let i = 0;
  const len = jsonStr.length;

  while (i < len) {
    const char = jsonStr[i];

    if (!inString) {
      if (char === '"') {
        inString = true;
      }
      result += char;
      i++;
      continue;
    }

    // Inside String Literal
    if (char === '"') {
      inString = false;
      result += char;
      i++;
      continue;
    }

    if (char === '\\') {
      const nextChar = i + 1 < len ? jsonStr[i + 1] : '';

      // Check if it's a valid standard JSON escape: \", \\, \/, \b, \f, \n, \r, \t, \uXXXX
      if (
        nextChar === '"' ||
        nextChar === '\\' ||
        nextChar === '/' ||
        nextChar === 'b' ||
        nextChar === 'f' ||
        nextChar === 'n' ||
        nextChar === 'r' ||
        nextChar === 't'
      ) {
        // Valid 1-character escape
        result += '\\' + nextChar;
        i += 2;
        continue;
      } else if (nextChar === 'u' && /^[0-9a-fA-F]{4}$/.test(jsonStr.substring(i + 2, i + 6))) {
        // Valid unicode escape \uXXXX
        result += jsonStr.substring(i, i + 6);
        i += 6;
        continue;
      } else {
        // Invalid escape (e.g. \theta, \cos, \sin, \alpha, \Delta, \frac, \cdot)
        // Double the backslash so it becomes valid JSON (\\theta, \\cos, etc.)
        result += '\\\\';
        i++;
        continue;
      }
    }

    // Raw unescaped control characters inside string
    if (char === '\n') {
      result += '\\n';
      i++;
      continue;
    }
    if (char === '\r') {
      result += '\\r';
      i++;
      continue;
    }
    if (char === '\t') {
      result += '\\t';
      i++;
      continue;
    }

    result += char;
    i++;
  }

  return result;
}
