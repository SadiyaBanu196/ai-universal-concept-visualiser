/**
 * Utility functions for normalizing, extracting math, and rendering Markdown & LaTeX
 * in AI Concept Tutor responses.
 */

import katex from 'katex';

export interface MathItem {
  id: string;
  raw: string;
  formula: string;
  isBlock: boolean;
}

/**
 * Normalizes unnecessarily escaped Markdown markers and LaTeX delimiters
 * emitted by language models or JSON stringification, without altering legitimate text.
 */
export function normalizeTutorMarkdown(input: string): string {
  if (!input || typeof input !== 'string') return '';
  let text = input;

  // 1. Normalize escaped block dollar delimiters: \$$ ... \$$ or \$$ ... $$
  text = text.replace(/\\+\$\s*\\+\$([\s\S]*?)\\+\$\s*\\+\$/g, '$$$$1$$');
  text = text.replace(/\\+\$\$([\s\S]*?)\$\$\\+/g, '$$$$1$$');
  text = text.replace(/\\+\$\$([\s\S]*?)\$\$/g, '$$$$1$$');
  text = text.replace(/\$\$([\s\S]*?)\$\$\\+/g, '$$$$1$$');

  // 2. Normalize escaped inline dollar delimiters: \$ ... \$ or \$ ... $ or $ ... \$
  text = text.replace(/\\+\$([^\$\n]+?)\\+\$/g, '$$$1$$');
  text = text.replace(/\\+\$([^\$\n]+?)\$/g, '$$$1$$');
  text = text.replace(/\$([^\$\n]+?)\\+\$/g, '$$$1$$');

  // 3. Normalize escaped headings at the start of a line: \#, \##, \###, etc.
  text = text.replace(/^([ \t]*)\\+(#{1,6}[ \t]+)/gm, '$1$2');

  // 4. Normalize escaped unordered list markers at the start of a line: \*, \-, \+
  text = text.replace(/^([ \t]*)\\+([*\-+][ \t]+)/gm, '$1$2');

  // 5. Normalize escaped bold formatting: \*\*bold\*\* or \_\_bold\_\_
  text = text.replace(/\\+\*\\+\*(.*?)\\+\*\\+\*/g, '**$1**');
  text = text.replace(/\\+\*\*(.*?)\*\*\\+/g, '**$1**');
  text = text.replace(/\\+\*\*(.*?)\*\*/g, '**$1**');
  text = text.replace(/\*\*(.*?)\*\*\\+/g, '**$1**');
  text = text.replace(/\\+__([^_]+?)__\\+/g, '__$1__');
  text = text.replace(/\\+_\\+_(.*?)_\\+_\\+/g, '__$1__');

  // 6. Normalize escaped italic markers only when paired around formatting words:
  // e.g. \*rate\* or \*concept\*, but preserve multiplication like "5 \* 3 = 15"
  text = text.replace(/(^|[\s(])\\+\*([^\s*].*?[^\s*])\\+\*(?=[\s).,;:!?]|$)/g, '$1*$2*');

  return text;
}

/**
 * Extracts LaTeX mathematical expressions (both block $$...$$, \[...\] and inline $...$, \(...\))
 * and substitutes them with unique placeholders so Markdown lexers cannot corrupt formulas
 * containing underscores, asterisks, or brackets.
 */
export function extractMathPlaceholders(rawInput: string): {
  normalizedText: string;
  mathMap: Map<string, MathItem>;
} {
  const normalized = normalizeTutorMarkdown(rawInput);
  const mathMap = new Map<string, MathItem>();

  // Matches:
  // - $$ ... $$ (block)
  // - \[ ... \] or \\[ ... \\] (block)
  // - $ ... $ (inline, non-empty, single line)
  // - \( ... \) or \\( ... \\) (inline)
  const MATH_REGEX = /(\$\$[\s\S]*?\$\$|\\{1,2}\[[\s\S]*?\\{1,2}\]|\$(?:\\\$|[^\$\n])+?\$|\\{1,2}\([\s\S]*?\\{1,2}\))/g;

  let counter = 0;
  const normalizedText = normalized.replace(MATH_REGEX, (match) => {
    const isDoubleDollar = match.startsWith('$$') && match.endsWith('$$');
    const isBracketBlock = /^\\{1,2}\[[\s\S]*?\\{1,2}\]$/.test(match);
    const isBracketInline = /^\\{1,2}\([\s\S]*?\\{1,2}\)$/.test(match);
    const isSingleDollar = match.startsWith('$') && match.endsWith('$') && !isDoubleDollar;

    const isBlock = isDoubleDollar || isBracketBlock;
    let formula = match;

    if (isDoubleDollar) {
      formula = match.slice(2, -2);
    } else if (isBracketBlock) {
      formula = match.replace(/^\\{1,2}\[|\\{1,2}\]$/g, '');
    } else if (isBracketInline) {
      formula = match.replace(/^\\{1,2}\(|\\{1,2}\)$/g, '');
    } else if (isSingleDollar) {
      formula = match.slice(1, -1);
    }

    const id = `MATHPH_${counter++}_HPHTAM`;
    mathMap.set(id, {
      id,
      raw: match,
      formula: formula.trim(),
      isBlock,
    });

    // Provide line breaks around block math placeholders so marked parses them as separate blocks
    return isBlock ? `\n\n${id}\n\n` : id;
  });

  return { normalizedText, mathMap };
}

/**
 * Safely renders LaTeX mathematical expressions to HTML using KaTeX.
 * Prevents throwing errors on malformed formulas and returns a safe fallback.
 */
export function renderKatexHtml(formula: string, isBlock: boolean): string {
  try {
    return katex.renderToString(formula, {
      displayMode: isBlock,
      throwOnError: false,
      output: 'htmlAndMathml',
      strict: false,
    });
  } catch (err: any) {
    const escaped = formula.replace(/[&<>"']/g, (m) => {
      switch (m) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        default: return '&#39;';
      }
    });
    return `<span class="katex-error font-mono text-amber-700 bg-amber-50 px-1 py-0.5 rounded text-[11px]">${escaped}</span>`;
  }
}
