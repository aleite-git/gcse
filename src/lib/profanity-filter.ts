import { Profanity } from '@2toad/profanity';
import { ProfanityFilter } from './mobile-auth';

let cachedFilter: ProfanityFilter | null = null;
let cachedProfanity: Profanity | null = null;

function buildFilter(): ProfanityFilter {
  cachedProfanity = new Profanity({
    wholeWord: false,
    languages: ['en', 'ar', 'de', 'es', 'fr', 'it', 'hi', 'ja', 'ko', 'pt', 'ru', 'zh'],
  });

  return {
    isProfane(text: string): boolean {
      return cachedProfanity?.exists(text) ?? false;
    },
  };
}

export function createProfanityFilter(): ProfanityFilter {
  if (!cachedFilter) {
    cachedFilter = buildFilter();
  }

  return cachedFilter;
}
