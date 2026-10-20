/**
 * Verification & Text Processing Utilities
 * - Robust sentence splitting for notes
 * - Excerpt verification against source notes (ignoring case, whitespace, formatting)
 * - Excerpt location finding for highlighting
 */

/**
 * Normalizes text for lenient comparison:
 * Lowercase, normalize unicode, collapse all whitespace to single spaces.
 */
export function normalizeText(text) {
  if (!text) return '';
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Splits text into numbered sentences while respecting common abbreviations,
 * decimals, and formatting.
 * Returns array of objects: { index: 1, text: "...", start: 0, end: 45 }
 */
export function splitSentences(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];

  // Regex handles sentence terminators (. ! ?) followed by whitespace or end of line,
  // avoiding common abbreviations like e.g., i.e., etc., vs., fig., no., approx.
  // and numbers like 192.168.1.1 or 3.14
  const abbrRegex = /(?:e\.g|i\.e|etc|vs|dr|mr|mrs|ms|prof|approx|fig|no|inc|corp|co)\.$/i;
  
  // We can scan through or use Intl.Segmenter if available, with a smart fallback
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    try {
      const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
      const segments = Array.from(segmenter.segment(rawText));
      const sentences = [];
      let tempText = '';
      let tempStart = -1;

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const text = seg.segment;
        if (tempStart === -1) tempStart = seg.index;
        tempText += text;

        const trimmed = tempText.trim();
        // Check if ends with abbreviation
        const lastWord = trimmed.split(/\s+/).pop() || '';
        if (abbrRegex.test(lastWord) && i < segments.length - 1) {
          // Keep accumulating
          continue;
        }

        if (trimmed.length > 0) {
          sentences.push({
            index: sentences.length + 1,
            text: trimmed,
            start: tempStart,
            end: tempStart + tempText.length
          });
        }
        tempText = '';
        tempStart = -1;
      }

      if (tempText.trim().length > 0) {
        sentences.push({
          index: sentences.length + 1,
          text: tempText.trim(),
          start: tempStart,
          end: tempStart + tempText.length
        });
      }

      return sentences;
    } catch {
      // Fallback below
    }
  }

  // Fallback regex-based splitter
  const sentenceEndPattern = /([.!?]+)(?:\s+(?=[A-Z0-9"'])|$)/g;
  const sentences = [];
  let lastIndex = 0;
  let match;

  while ((match = sentenceEndPattern.exec(rawText)) !== null) {
    const endOfMatch = match.index + match[1].length;
    const candidate = rawText.slice(lastIndex, endOfMatch).trim();
    const lastWord = candidate.split(/\s+/).pop() || '';

    if (abbrRegex.test(lastWord) && endOfMatch < rawText.length) {
      // Abbreviation, don't split yet
      continue;
    }

    if (candidate.length > 0) {
      sentences.push({
        index: sentences.length + 1,
        text: candidate,
        start: lastIndex,
        end: endOfMatch
      });
    }
    lastIndex = sentenceEndPattern.lastIndex;
  }

  const remainder = rawText.slice(lastIndex).trim();
  if (remainder.length > 0) {
    sentences.push({
      index: sentences.length + 1,
      text: remainder,
      start: lastIndex,
      end: rawText.length
    });
  }

  return sentences;
}

/**
 * Checks whether an excerpt appears in the source text.
 * Returns:
 * {
 *   found: boolean,
 *   status: 'verified' | 'excerpt not found',
 *   cleanExcerpt: string,
 *   matchSpan: { start: number, end: number } | null
 * }
 */
export function verifyExcerpt(sourceText, excerpt) {
  if (!sourceText || !excerpt) {
    return {
      found: false,
      status: 'excerpt not found',
      cleanExcerpt: (excerpt || '').trim(),
      matchSpan: null
    };
  }

  const cleanExcerpt = excerpt.trim();
  if (!cleanExcerpt) {
    return {
      found: false,
      status: 'excerpt not found',
      cleanExcerpt: '',
      matchSpan: null
    };
  }

  // 1. Exact match check
  const exactIdx = sourceText.indexOf(cleanExcerpt);
  if (exactIdx !== -1) {
    return {
      found: true,
      status: 'verified',
      cleanExcerpt,
      matchSpan: { start: exactIdx, end: exactIdx + cleanExcerpt.length }
    };
  }

  // 2. Normalized check (ignoring case, newline differences, and multi-spaces)
  const normSource = normalizeText(sourceText);
  const normExcerpt = normalizeText(cleanExcerpt);

  const normIdx = normSource.indexOf(normExcerpt);
  if (normIdx !== -1) {
    // Find approximate location in original text
    const span = locateNormalizedSpan(sourceText, normExcerpt);
    return {
      found: true,
      status: 'verified',
      cleanExcerpt,
      matchSpan: span
    };
  }

  // 3. Punctuation-lenient check (strip surrounding quotes or trailing period differences)
  const strippedExcerpt = normExcerpt.replace(/^[“"']+|[”"'.]+$/g, '').trim();
  if (strippedExcerpt.length >= 10) {
    const strippedIdx = normSource.indexOf(strippedExcerpt);
    if (strippedIdx !== -1) {
      const span = locateNormalizedSpan(sourceText, strippedExcerpt);
      return {
        found: true,
        status: 'verified',
        cleanExcerpt,
        matchSpan: span
      };
    }
  }

  return {
    found: false,
    status: 'excerpt not found',
    cleanExcerpt,
    matchSpan: null
  };
}

/**
 * Maps a normalized substring back to character coordinates in original source
 */
function locateNormalizedSpan(original, normalizedNeedle) {
  // Simple token/word-based boundary finder
  const words = normalizedNeedle.split(' ').filter(Boolean);
  if (words.length === 0) return null;

  const firstWord = words[0];
  const lastWord = words[words.length - 1];

  const firstIdx = original.toLowerCase().indexOf(firstWord.toLowerCase());
  if (firstIdx === -1) return null;

  const lastIdx = original.toLowerCase().indexOf(lastWord.toLowerCase(), firstIdx);
  if (lastIdx === -1) {
    return { start: firstIdx, end: Math.min(original.length, firstIdx + normalizedNeedle.length) };
  }

  return {
    start: firstIdx,
    end: lastIdx + lastWord.length
  };
}

/**
 * Highlight an excerpt in source HTML. Returns safe HTML with <mark> tags.
 */
export function highlightExcerptInHtml(sourceText, excerpt) {
  if (!sourceText) return '';
  if (!excerpt) return escapeHtml(sourceText);

  const verification = verifyExcerpt(sourceText, excerpt);
  if (!verification.found || !verification.matchSpan) {
    return escapeHtml(sourceText);
  }

  const { start, end } = verification.matchSpan;
  const before = escapeHtml(sourceText.slice(0, start));
  const target = escapeHtml(sourceText.slice(start, end));
  const after = escapeHtml(sourceText.slice(end));

  return `${before}<mark class="source-highlight">${target}</mark>${after}`;
}

export function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
