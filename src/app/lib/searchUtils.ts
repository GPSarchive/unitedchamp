// Search utilities for text normalization and query parsing

/**
 * Greek diacritic normalization map
 * Removes accents from Greek characters for search matching
 */
const GREEK_DIACRITIC_MAP: Record<string, string> = {
  // Uppercase with accents
  'Ά': 'Α', 'Έ': 'Ε', 'Ή': 'Η', 'Ί': 'Ι', 'Ό': 'Ο', 'Ύ': 'Υ', 'Ώ': 'Ω',
  'Ϊ': 'Ι', 'Ϋ': 'Υ',

  // Lowercase with accents
  'ά': 'α', 'έ': 'ε', 'ή': 'η', 'ί': 'ι', 'ό': 'ο', 'ύ': 'υ', 'ώ': 'ω',
  'ϊ': 'ι', 'ϋ': 'υ', 'ΐ': 'ι', 'ΰ': 'υ',
};

/**
 * Greek to Latin transliteration map
 * For searching Greek names with Latin characters
 */
const GREEK_TO_LATIN: Record<string, string> = {
  // Uppercase
  'Α': 'A', 'Β': 'B', 'Γ': 'G', 'Δ': 'D', 'Ε': 'E', 'Ζ': 'Z', 'Η': 'H',
  'Θ': 'TH', 'Ι': 'I', 'Κ': 'K', 'Λ': 'L', 'Μ': 'M', 'Ν': 'N', 'Ξ': 'X',
  'Ο': 'O', 'Π': 'P', 'Ρ': 'R', 'Σ': 'S', 'Τ': 'T', 'Υ': 'Y', 'Φ': 'F',
  'Χ': 'CH', 'Ψ': 'PS', 'Ω': 'O',

  // Lowercase
  'α': 'a', 'β': 'b', 'γ': 'g', 'δ': 'd', 'ε': 'e', 'ζ': 'z', 'η': 'h',
  'θ': 'th', 'ι': 'i', 'κ': 'k', 'λ': 'l', 'μ': 'm', 'ν': 'n', 'ξ': 'x',
  'ο': 'o', 'π': 'p', 'ρ': 'r', 'σ': 's', 'ς': 's', 'τ': 't', 'υ': 'y',
  'φ': 'f', 'χ': 'ch', 'ψ': 'ps', 'ω': 'o',
};

/**
 * Latin to Greek transliteration map (reverse)
 * For searching Latin input against Greek names
 */
const LATIN_TO_GREEK: Record<string, string> = {
  // Common patterns (longer patterns first for greedy matching)
  'th': 'θ', 'TH': 'Θ', 'Th': 'Θ',
  'ch': 'χ', 'CH': 'Χ', 'Ch': 'Χ',
  'ps': 'ψ', 'PS': 'Ψ', 'Ps': 'Ψ',

  // Single characters
  'a': 'α', 'A': 'Α', 'b': 'β', 'B': 'Β', 'g': 'γ', 'G': 'Γ',
  'd': 'δ', 'D': 'Δ', 'e': 'ε', 'E': 'Ε', 'z': 'ζ', 'Z': 'Ζ',
  'h': 'η', 'H': 'Η', 'i': 'ι', 'I': 'Ι', 'k': 'κ', 'K': 'Κ',
  'l': 'λ', 'L': 'Λ', 'm': 'μ', 'M': 'Μ', 'n': 'ν', 'N': 'Ν',
  'x': 'ξ', 'X': 'Ξ', 'o': 'ο', 'O': 'Ο', 'p': 'π', 'P': 'Π',
  'r': 'ρ', 'R': 'Ρ', 's': 'σ', 'S': 'Σ', 't': 'τ', 'T': 'Τ',
  'y': 'υ', 'Y': 'Υ', 'f': 'φ', 'F': 'Φ', 'w': 'ω', 'W': 'Ω',
};

/**
 * Remove diacritics from Greek text
 * Example: "Αντώνης" -> "Αντωνης"
 */
export function removeGreekDiacritics(text: string): string {
  return text.split('').map(char => GREEK_DIACRITIC_MAP[char] || char).join('');
}

/**
 * Transliterate Greek to Latin
 * Example: "Αντώνης" -> "Antonis"
 */
export function greekToLatin(text: string): string {
  // First remove diacritics
  const normalized = removeGreekDiacritics(text);

  // Then transliterate (handle multi-char patterns first)
  let result = '';
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    const twoChar = normalized.substring(i, i + 2);

    // Check for multi-character mappings
    if (GREEK_TO_LATIN[twoChar]) {
      result += GREEK_TO_LATIN[twoChar];
      i++; // Skip next character
    } else if (GREEK_TO_LATIN[char]) {
      result += GREEK_TO_LATIN[char];
    } else {
      result += char;
    }
  }

  return result;
}

/**
 * Transliterate Latin to Greek (best effort)
 * Example: "Antonis" -> "Αντονις"
 */
export function latinToGreek(text: string): string {
  let result = '';
  let i = 0;

  while (i < text.length) {
    // Try 2-character patterns first
    const twoChar = text.substring(i, i + 2);
    const twoCharLower = twoChar.toLowerCase();

    if (LATIN_TO_GREEK[twoChar]) {
      result += LATIN_TO_GREEK[twoChar];
      i += 2;
    } else if (LATIN_TO_GREEK[twoCharLower]) {
      result += LATIN_TO_GREEK[twoCharLower];
      i += 2;
    } else {
      // Try single character
      const char = text[i];
      result += LATIN_TO_GREEK[char] || char;
      i++;
    }
  }

  return result;
}

/**
 * Normalize text for search (both Greek and Latin variants)
 * Returns array of normalized variants for comprehensive matching
 */
export function normalizeForSearch(text: string): string[] {
  const variants = new Set<string>();
  const trimmed = text.trim().toLowerCase();

  // Add original (lowercased)
  variants.add(trimmed);

  // Add without diacritics
  const noDiacritics = removeGreekDiacritics(trimmed);
  variants.add(noDiacritics);

  // Add Latin transliteration
  const latin = greekToLatin(trimmed);
  variants.add(latin.toLowerCase());

  // Add Greek transliteration (if input is Latin)
  if (!/[α-ωΑ-Ω]/.test(trimmed)) {
    const greek = latinToGreek(trimmed);
    variants.add(greek.toLowerCase());
  }

  return Array.from(variants);
}

/**
 * Parsed search query structure
 */
export type ParsedSearchQuery = {
  text: string[];          // General text search terms
  team?: string[];         // team:Barcelona
  position?: string[];     // position:Forward
  minGoals?: number;       // goals:>10
  minMatches?: number;     // matches:>5
  minAssists?: number;     // assists:>3
};

/**
 * Parse search query with field-specific syntax
 *
 * Supports:
 * - team:Barcelona - filter by team name
 * - position:Forward - filter by position
 * - goals:>10 - filter by goals greater than 10
 * - matches:>5 - filter by matches greater than 5
 * - assists:>3 - filter by assists greater than 3
 * - Plain text - searches across name, team, position
 *
 * Examples:
 * - "team:Barcelona Messi" -> team filter + text search
 * - "position:Forward goals:>10" -> position + goals filter
 * - "Αντώνης" -> searches both Greek and Latin variants
 */
export function parseSearchQuery(query: string): ParsedSearchQuery {
  const result: ParsedSearchQuery = {
    text: [],
  };

  // Split by spaces but preserve quoted strings
  const tokens = query.match(/(?:[^\s"]+|"[^"]*")+/g) || [];

  for (let token of tokens) {
    // Remove quotes
    token = token.replace(/^"|"$/g, '').trim();
    if (!token) continue;

    // Check for field-specific syntax
    if (token.includes(':')) {
      const [field, value] = token.split(':', 2);
      const fieldLower = field.toLowerCase();
      const valueTrimmed = value.trim();

      switch (fieldLower) {
        case 'team':
        case 'ομάδα':
        case 'omada':
          if (!result.team) result.team = [];
          result.team.push(valueTrimmed);
          break;

        case 'position':
        case 'θέση':
        case 'thesi':
          if (!result.position) result.position = [];
          result.position.push(valueTrimmed);
          break;

        case 'goals':
        case 'γκολ':
        case 'gkol':
          // Support >N, >=N, N formats
          const goalsMatch = valueTrimmed.match(/^(>=?)?(\d+)$/);
          if (goalsMatch) {
            result.minGoals = parseInt(goalsMatch[2], 10);
          }
          break;

        case 'matches':
        case 'αγώνες':
        case 'agones':
          const matchesMatch = valueTrimmed.match(/^(>=?)?(\d+)$/);
          if (matchesMatch) {
            result.minMatches = parseInt(matchesMatch[2], 10);
          }
          break;

        case 'assists':
        case 'ασίστ':
        case 'asist':
          const assistsMatch = valueTrimmed.match(/^(>=?)?(\d+)$/);
          if (assistsMatch) {
            result.minAssists = parseInt(assistsMatch[2], 10);
          }
          break;

        default:
          // Unknown field, treat as text
          result.text.push(token);
      }
    } else {
      // Plain text search term
      result.text.push(token);
    }
  }

  return result;
}

/**
 * Create SQL ILIKE pattern for search
 * Handles both Greek and Latin variants
 */
export function createSearchPattern(term: string): string {
  return `%${term}%`;
}

/**
 * Check if text matches search term (with diacritic normalization)
 */
export function matchesSearch(text: string, searchTerm: string): boolean {
  const textVariants = normalizeForSearch(text);
  const searchVariants = normalizeForSearch(searchTerm);

  // Check if any search variant matches any text variant
  for (const searchVar of searchVariants) {
    for (const textVar of textVariants) {
      if (textVar.includes(searchVar)) {
        return true;
      }
    }
  }

  return false;
}
