/**
 * Text formatting and filtering utilities for PostFlow.
 */

/**
 * Strips emoji characters, pictographs, symbols, and presentation selectors
 * from text, while preserving standard text, accents, punctuation, and line breaks.
 * Also cleans up any double spacing or awkward spaces before punctuation left behind.
 */
export function stripEmojis(text: string): string {
  if (!text || typeof text !== 'string') return '';

  return text
    // Remove Unicode pictographs and standard emoji blocks
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F3FB}-\u{1F3FF}\u{200D}\u{20D0}-\u{20FF}\u{2300}-\u{23FF}\u{2B50}\u{2B55}\u{2934}\u{2935}\u{25AA}\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}]/gu, '')
    // Collapse multi-spaces on the same line without destroying newlines
    .replace(/[ \t]{2,}/g, ' ')
    // Remove space before punctuation left behind by removed emoji (e.g., "Hello ! " -> "Hello! ")
    .replace(/[ \t]+([.,!?:;])/g, '$1')
    // Remove trailing spaces at line endings
    .replace(/[ \t]+$/gm, '')
    .trim();
}
