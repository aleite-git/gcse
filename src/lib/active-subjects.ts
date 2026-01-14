export const ACTIVE_SUBJECTS = ['Biology', 'Chemistry', 'Computer Science'] as const;

export type ActiveSubject = (typeof ACTIVE_SUBJECTS)[number];

type ValidationResult = { value: ActiveSubject[] } | { error: string };

export function validateActiveSubjects(
  input: unknown,
  options?: { allowEmpty?: boolean }
): ValidationResult {
  const allowEmpty = options?.allowEmpty ?? false;

  if (!Array.isArray(input)) {
    return { error: 'activeSubjects must be an array' };
  }

  if (!allowEmpty && input.length === 0) {
    return { error: 'activeSubjects must contain at least one subject' };
  }

  if (input.length > ACTIVE_SUBJECTS.length) {
    return { error: `activeSubjects cannot contain more than ${ACTIVE_SUBJECTS.length} subjects` };
  }

  const seen = new Set<string>();
  const normalized: ActiveSubject[] = [];

  for (const subject of input) {
    if (typeof subject !== 'string') {
      return { error: 'activeSubjects must contain only strings' };
    }

    if (!ACTIVE_SUBJECTS.includes(subject as ActiveSubject)) {
      return { error: `invalid subject: '${subject}'` };
    }

    const key = subject.toLowerCase();
    if (seen.has(key)) {
      return { error: 'activeSubjects must not contain duplicates' };
    }

    seen.add(key);
    normalized.push(subject as ActiveSubject);
  }

  return { value: normalized };
}
