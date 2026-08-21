/**
 * Wraps comments in a "code-comment" span (see globals.css) and
 * HTML-escapes everything else, leaving all other text (variables,
 * keywords, punctuation) at the default color — a deliberately narrow
 * scope, not a general JS token highlighter.
 */

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Matches a full string literal OR a line/block comment in one pass, so
// a "//" inside a string (e.g. a URL) is consumed as part of the string
// and never mistaken for the start of a comment.
const TOKEN_RE = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g;

export function highlightComments(code: string): string {
  let result = "";
  let lastIndex = 0;
  TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN_RE.exec(code))) {
    result += escapeHtml(code.slice(lastIndex, match.index));
    const token = match[0];
    result +=
      token.startsWith("//") || token.startsWith("/*")
        ? `<span class="code-comment">${escapeHtml(token)}</span>`
        : escapeHtml(token);
    lastIndex = match.index + token.length;
  }
  result += escapeHtml(code.slice(lastIndex));
  return result;
}
