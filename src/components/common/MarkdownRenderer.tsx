/**
 * Markdown & Mathematical Equation Renderer for AI Concept Tutor
 * Transforms raw markdown, LaTeX delimiters, and math formulas into structured,
 * safe React elements styled for the Smoke/Sage theme.
 */

import React, { useMemo } from 'react';
import { marked, Token, Tokens } from 'marked';
import { extractMathPlaceholders, renderKatexHtml, MathItem } from '../../utils/markdownUtils';

interface Props {
  content: string;
  className?: string;
  isUser?: boolean;
}

export const MarkdownRenderer: React.FC<Props> = ({ content, className = '', isUser = false }) => {
  const { elements } = useMemo(() => {
    if (!content) return { elements: [] };

    const { normalizedText, mathMap } = extractMathPlaceholders(content);
    const tokens = marked.lexer(normalizedText);

    const rendered = renderTokens(tokens, mathMap, isUser);
    return { elements: rendered };
  }, [content, isUser]);

  return (
    <div className={`space-y-1.5 break-words ${className}`}>
      {elements}
    </div>
  );
};

function renderTokens(
  tokens: Token[],
  mathMap: Map<string, MathItem>,
  isUser: boolean
): React.ReactNode[] {
  return tokens.map((token, idx) => renderToken(token, idx, mathMap, isUser));
}

function renderToken(
  token: Token,
  index: number,
  mathMap: Map<string, MathItem>,
  isUser: boolean
): React.ReactNode {
  switch (token.type) {
    case 'heading': {
      const depth = Math.min(Math.max(token.depth, 1), 6);
      const headingClasses = [
        'text-sm font-bold text-smoke-950 mt-3 mb-1.5 font-display',
        'text-xs font-bold text-smoke-950 mt-2.5 mb-1',
        'text-xs font-semibold text-smoke-900 mt-2 mb-1 uppercase tracking-wide font-mono',
        'text-xs font-semibold text-smoke-900 mt-1.5 mb-1',
        'text-[11px] font-semibold text-smoke-800 mt-1 mb-0.5',
        'text-[11px] font-medium text-smoke-700 mt-1 mb-0.5',
      ][depth - 1];

      const children = renderInlineTokens(token.tokens || [], mathMap, isUser);
      if (depth === 1) return <h1 key={index} className={headingClasses}>{children}</h1>;
      if (depth === 2) return <h2 key={index} className={headingClasses}>{children}</h2>;
      if (depth === 3) return <h3 key={index} className={headingClasses}>{children}</h3>;
      if (depth === 4) return <h4 key={index} className={headingClasses}>{children}</h4>;
      if (depth === 5) return <h5 key={index} className={headingClasses}>{children}</h5>;
      return <h6 key={index} className={headingClasses}>{children}</h6>;
    }

    case 'paragraph': {
      // Check if paragraph consists solely of a block math placeholder
      const trimmedText = token.text?.trim() || '';
      const singleMathMatch = trimmedText.match(/^(MATHPH_\d+_HPHTAM)$/);
      if (singleMathMatch) {
        const item = mathMap.get(singleMathMatch[1]);
        if (item && item.isBlock) {
          return renderMathBlock(item, index, isUser);
        }
      }

      return (
        <p key={index} className={`text-xs leading-relaxed my-1.5 first:mt-0 last:mb-0 ${isUser ? 'text-white' : 'text-smoke-900'}`}>
          {renderInlineTokens(token.tokens || [], mathMap, isUser)}
        </p>
      );
    }

    case 'list': {
      const items = token.items.map((item: Tokens.ListItem, itemIdx: number) => {
        const itemChildren = item.tokens && item.tokens.length > 0
          ? renderTokens(item.tokens, mathMap, isUser)
          : renderInlineTokens((item as any).tokens || [], mathMap, isUser);

        return (
          <li key={itemIdx} className="leading-relaxed">
            {itemChildren}
          </li>
        );
      });

      if (token.ordered) {
        return (
          <ol key={index} className={`list-decimal pl-4 space-y-1 my-1.5 text-xs ${isUser ? 'text-white' : 'text-smoke-900'}`}>
            {items}
          </ol>
        );
      }
      return (
        <ul key={index} className={`list-disc pl-4 space-y-1 my-1.5 text-xs ${isUser ? 'text-white marker:text-smoke-300' : 'text-smoke-900 marker:text-smoke-400'}`}>
          {items}
        </ul>
      );
    }

    case 'code': {
      return (
        <pre
          key={index}
          className={`p-2.5 rounded-lg font-mono text-[11px] overflow-x-auto my-2 border ${
            isUser ? 'bg-smoke-900/90 text-smoke-100 border-smoke-700' : 'bg-smoke-200/80 text-smoke-900 border-smoke-300/80'
          }`}
        >
          <code className="font-mono">{token.text}</code>
        </pre>
      );
    }

    case 'blockquote': {
      return (
        <blockquote
          key={index}
          className={`border-l-2 pl-3 my-2 italic text-xs ${
            isUser ? 'border-smoke-400 text-smoke-200' : 'border-smoke-400 text-smoke-700'
          }`}
        >
          {renderTokens(token.tokens || [], mathMap, isUser)}
        </blockquote>
      );
    }

    case 'table': {
      return (
        <div key={index} className="overflow-x-auto my-2 rounded-lg border border-smoke-200 shadow-2xs">
          <table className="min-w-full text-xs text-left">
            <thead className="bg-smoke-200/70 text-smoke-800 font-semibold border-b border-smoke-200">
              <tr>
                {token.header.map((cell: Tokens.TableCell, cIdx: number) => (
                  <th key={cIdx} className="px-2.5 py-1.5 border-r border-smoke-200 last:border-none font-mono text-[11px]">
                    {renderInlineTokens(cell.tokens || [], mathMap, isUser)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-smoke-200/60">
              {token.rows.map((row: Tokens.TableCell[], rIdx: number) => (
                <tr key={rIdx} className="hover:bg-smoke-50/60 transition-colors">
                  {row.map((cell: Tokens.TableCell, cIdx: number) => (
                    <td key={cIdx} className="px-2.5 py-1.5 border-r border-smoke-200 last:border-none">
                      {renderInlineTokens(cell.tokens || [], mathMap, isUser)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case 'hr': {
      return <hr key={index} className={`my-2 ${isUser ? 'border-smoke-600' : 'border-smoke-200'}`} />;
    }

    case 'space':
      return null;

    default: {
      if ('tokens' in token && Array.isArray((token as any).tokens)) {
        return (
          <div key={index} className="text-xs">
            {renderInlineTokens((token as any).tokens, mathMap, isUser)}
          </div>
        );
      }
      return (
        <span key={index}>
          {replaceMathPlaceholders(token.raw || '', mathMap, isUser)}
        </span>
      );
    }
  }
}

function renderInlineTokens(
  tokens: Token[],
  mathMap: Map<string, MathItem>,
  isUser: boolean
): React.ReactNode[] {
  return tokens.map((token, idx) => {
    switch (token.type) {
      case 'strong':
        return (
          <strong key={idx} className={`font-bold ${isUser ? 'text-white' : 'text-smoke-950'}`}>
            {renderInlineTokens(token.tokens || [], mathMap, isUser)}
          </strong>
        );

      case 'em':
        return (
          <em key={idx} className={`italic ${isUser ? 'text-smoke-100' : 'text-smoke-800'}`}>
            {renderInlineTokens(token.tokens || [], mathMap, isUser)}
          </em>
        );

      case 'codespan':
        return (
          <code
            key={idx}
            className={`font-mono text-[11px] px-1 py-0.5 rounded border ${
              isUser
                ? 'bg-smoke-700 text-smoke-100 border-smoke-600'
                : 'bg-smoke-200/70 text-smoke-900 border-smoke-300'
            }`}
          >
            {token.text}
          </code>
        );

      case 'del':
        return (
          <del key={idx} className="line-through opacity-75">
            {renderInlineTokens(token.tokens || [], mathMap, isUser)}
          </del>
        );

      case 'link':
        return (
          <span key={idx} className="underline underline-offset-2 font-medium">
            {renderInlineTokens(token.tokens || [], mathMap, isUser)}
          </span>
        );

      case 'br':
        return <br key={idx} />;

      case 'text':
      default: {
        const rawText = 'text' in token ? (token as any).text : (token.raw || '');
        return (
          <React.Fragment key={idx}>
            {replaceMathPlaceholders(rawText, mathMap, isUser)}
          </React.Fragment>
        );
      }
    }
  });
}

function replaceMathPlaceholders(
  text: string,
  mathMap: Map<string, MathItem>,
  isUser: boolean
): React.ReactNode {
  if (!text) return null;
  const parts = text.split(/(MATHPH_\d+_HPHTAM)/g);

  if (parts.length === 1) {
    return text;
  }

  return parts.map((part, pIdx) => {
    const item = mathMap.get(part);
    if (!item) return part;

    if (item.isBlock) {
      return renderMathBlock(item, pIdx, isUser);
    }
    return renderMathInline(item, pIdx, isUser);
  });
}

function renderMathBlock(item: MathItem, key: number | string, isUser: boolean): React.ReactNode {
  const html = renderKatexHtml(item.formula, true);
  return (
    <div
      key={key}
      className={`my-2 py-1.5 px-3 overflow-x-auto text-center rounded-lg border shadow-2xs ${
        isUser
          ? 'bg-smoke-700/80 border-smoke-600 text-white'
          : 'bg-smoke-50 border-smoke-200 text-smoke-900'
      }`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function renderMathInline(item: MathItem, key: number | string, isUser: boolean): React.ReactNode {
  const html = renderKatexHtml(item.formula, false);
  return (
    <span
      key={key}
      className={`inline-block mx-0.5 align-baseline px-0.5 rounded ${
        isUser ? 'text-white' : 'text-smoke-950'
      }`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
