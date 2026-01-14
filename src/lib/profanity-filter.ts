import LeoProfanity from 'leo-profanity';
import naughtyWords from 'naughty-words';
import { ProfanityFilter } from './mobile-auth';

type LeoProfanityFilter = {
  wordDictionary?: Record<string, string[]>;
  clearList: () => void;
  add: (data: string[] | string) => void;
  loadDictionary: (name?: string) => void;
  check: (text: string) => boolean;
};

const LEO_DICTIONARIES = ['en', 'fr', 'ru'];
const NAUGHTY_DICTIONARIES = ['pt', 'es', 'de', 'hi'];
let cachedFilter: ProfanityFilter | null = null;

function normalizeWordList(words: string[] = []): string[] {
  return words
    .map((word) => word.trim().toLowerCase())
    .filter((word) => word.length > 0);
}

function buildFilter(): ProfanityFilter {
  const filter = LeoProfanity as unknown as LeoProfanityFilter;
  const leoWords = LEO_DICTIONARIES.flatMap((name) =>
    filter.wordDictionary?.[name] ? normalizeWordList(filter.wordDictionary[name]) : []
  );
  const naughtyWordsRecord = naughtyWords as Record<string, string[]>;
  const extraWords = NAUGHTY_DICTIONARIES.flatMap((name) =>
    naughtyWordsRecord[name] ? normalizeWordList(naughtyWordsRecord[name]) : []
  );
  const combinedWords = [...leoWords, ...extraWords];

  filter.clearList();

  if (combinedWords.length === 0) {
    filter.loadDictionary('en');
  } else {
    filter.add(combinedWords);
  }

  return {
    isProfane(text: string): boolean {
      return filter.check(text);
    },
  };
}

export function createProfanityFilter(): ProfanityFilter {
  if (!cachedFilter) {
    cachedFilter = buildFilter();
  }

  return cachedFilter;
}
