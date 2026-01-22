import * as fs from 'fs';

type Question = {
  id: string;
  stem: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  notes?: string;
  topic?: string;
  subject?: string;
  difficulty?: number;
};

const INPUT_PATH = 'biology_all_questions.json';
const OUTPUT_PATH = 'biology_all_questions-revised.json';

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'than', 'to', 'of', 'in', 'on', 'for',
  'with', 'from', 'by', 'as', 'at', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'this',
  'that', 'these', 'those', 'it', 'its', 'they', 'their', 'them', 'which', 'what', 'why',
  'how', 'when', 'where', 'who', 'whom', 'can', 'could', 'would', 'should', 'may', 'might',
  'will', 'do', 'does', 'did', 'into', 'over', 'under', 'about', 'between', 'during',
]);

const TOPIC_HINTS: Record<string, string> = {
  'cell biology': 'Remember organelle functions, cell division, and transport across membranes.',
  'organisation': 'Remember tissue → organ → organ system, and how organs work together.',
  'infection and response': 'Remember pathogens vs viruses, immune responses, and antibiotics/vaccination.',
  'bioenergetics': 'Remember photosynthesis and respiration equations and limiting factors.',
  'homeostasis and response': 'Remember control systems, hormones, nerves, and feedback.',
  'inheritance, variation and evolution':
    'Remember genes/alleles, inheritance patterns, and natural selection.',
  'ecology': 'Remember ecosystems, food chains, and nutrient cycles.',
};

const UNIT_PATTERNS = [
  '%',
  'cm',
  'mm',
  'm',
  'km',
  'g',
  'kg',
  'mg',
  'l',
  'ml',
  's',
  'ms',
  'min',
  'mins',
  'minute',
  'minutes',
  'hour',
  'hours',
  'day',
  'days',
  'year',
  'years',
  '°c',
  'c',
  'mol',
  'nm',
  'μm',
  'um',
  'µm',
];

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9%°\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractKeywords(stem: string): string[] {
  const words = normalizeText(stem).split(' ');
  const keywords = words.filter((w) => w.length > 3 && !STOPWORDS.has(w));
  const unique = Array.from(new Set(keywords));
  return unique.slice(0, 6);
}

function noteLooksHelpful(stem: string, notes: string | undefined): boolean {
  if (!notes) return false;
  const trimmed = notes.trim();
  if (trimmed.length < 40) return false;

  const stemWords = new Set(extractKeywords(stem));
  if (stemWords.size === 0) return true;

  const notesWords = new Set(extractKeywords(trimmed));
  let overlap = 0;
  for (const w of stemWords) {
    if (notesWords.has(w)) overlap++;
  }

  return overlap >= 2;
}

function buildNote(q: Question): string {
  const correct = q.options[q.correctIndex] || 'the correct option';
  const topicKey = q.topic ? normalizeText(q.topic) : '';
  const topicHint = TOPIC_HINTS[topicKey] || 'Focus on the key term(s) in the question stem.';
  const keywords = extractKeywords(q.stem);
  const keywordLine = keywords.length > 0 ? `Focus words: ${keywords.join(', ')}.` : '';

  return [
    topicHint,
    keywordLine,
    `This question points to: "${correct}".`,
  ]
    .filter(Boolean)
    .join(' ');
}

function detectSingleUnit(options: string[]): string | null {
  const found = new Set<string>();
  for (const opt of options) {
    const normalized = normalizeText(opt);
    for (const unit of UNIT_PATTERNS) {
      if (normalized.includes(unit)) {
        found.add(unit);
      }
    }
  }
  if (found.size === 1) {
    return Array.from(found)[0];
  }
  return null;
}

function looksNumeric(opt: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(opt.trim());
}

function normalizeOptions(options: string[]): { options: string[]; changed: boolean } {
  const unit = detectSingleUnit(options);
  if (!unit) return { options, changed: false };

  let changed = false;
  const normalized = options.map((opt) => {
    const trimmed = opt.trim();
    if (looksNumeric(trimmed)) {
      changed = true;
      return unit === '%' ? `${trimmed}%` : `${trimmed} ${unit}`;
    }
    return opt;
  });

  return { options: normalized, changed };
}

function reviseQuestion(q: Question): Question {
  const next = { ...q };

  if (!noteLooksHelpful(q.stem, q.notes)) {
    next.notes = buildNote(q);
  }

  const normalized = normalizeOptions(q.options);
  if (normalized.changed) {
    next.options = normalized.options;
  }

  return next;
}

function main() {
  const raw = fs.readFileSync(INPUT_PATH, 'utf-8');
  const questions = JSON.parse(raw) as Question[];

  const revised = questions.map(reviseQuestion);
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(revised, null, 2));

  console.log(`Revised ${questions.length} questions.`);
  console.log(`Wrote: ${OUTPUT_PATH}`);
}

main();
