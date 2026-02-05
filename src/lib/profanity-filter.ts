import { Profanity } from '@2toad/profanity';
import { ProfanityFilter } from './mobile-auth';

let cachedFilter: ProfanityFilter | null = null;
let cachedProfanity: Profanity | null = null;

type NormalizeOptions = {
  mapDigitWhenNextLetterOnly: boolean;
  stripTrailingDigits: boolean;
};

function normalizeForCheck(text: string, options: NormalizeOptions): string {
  const lower = text.toLowerCase();
  const tokens = lower.split(/[^a-z0-9@$!]+/);
  const digitMap: Record<string, string> = {
    '0': 'o',
    '1': 'i',
    '3': 'e',
    '4': 'a',
    '5': 's',
    '7': 't',
    '8': 'b',
    '9': 'g',
  };
  const symbolMap: Record<string, string> = {
    '@': 'a',
    '$': 's',
    '!': 'i',
  };

  const normalizedTokens = tokens
    .map((token) => {
      if (!/[a-z]/.test(token)) {
        return '';
      }

      let working = token;
      if (options.stripTrailingDigits) {
        working = working.replace(/[0-9]+$/g, '');
      }

      let out = '';
      for (let i = 0; i < working.length; i += 1) {
        const ch = working[i];
        if (ch >= 'a' && ch <= 'z') {
          out += ch;
          continue;
        }

        if (symbolMap[ch]) {
          out += symbolMap[ch];
          continue;
        }

        if (digitMap[ch]) {
          const prevIsLetter = i > 0 && working[i - 1] >= 'a' && working[i - 1] <= 'z';
          const nextIsLetter =
            i < working.length - 1 && working[i + 1] >= 'a' && working[i + 1] <= 'z';
          if (options.mapDigitWhenNextLetterOnly ? nextIsLetter : prevIsLetter || nextIsLetter) {
            out += digitMap[ch];
          }
        }
      }

      return out;
    })
    .filter((token) => token.length > 0);

  return normalizedTokens.join(' ').trim();
}

function buildFilter(): ProfanityFilter {
  cachedProfanity = new Profanity({
    wholeWord: true,
    languages: ['en', 'ar', 'de', 'es', 'fr', 'it', 'hi', 'ja', 'ko', 'pt', 'ru', 'zh'],
  });

  return {
    isProfane(text: string): boolean {
      if (!cachedProfanity) {
        return false;
      }

      const raw = text.toLowerCase();
      if (cachedProfanity.exists(raw)) {
        return true;
      }

      const normalizedStrict = normalizeForCheck(text, {
        mapDigitWhenNextLetterOnly: true,
        stripTrailingDigits: false,
      });
      if (normalizedStrict && cachedProfanity.exists(normalizedStrict)) {
        return true;
      }

      const normalizedLoose = normalizeForCheck(text, {
        mapDigitWhenNextLetterOnly: false,
        stripTrailingDigits: true,
      });
      return normalizedLoose ? cachedProfanity.exists(normalizedLoose) : false;
    },
  };
}

export function createProfanityFilter(): ProfanityFilter {
  if (!cachedFilter) {
    cachedFilter = buildFilter();
  }

  return cachedFilter;
}

// Test-only helper to reset the cached filter so we can exercise null-cache paths.
export function __resetProfanityCacheForTests(): void {
  cachedFilter = null;
  cachedProfanity = null;
}
