import { describe, expect, it } from '@jest/globals';
import { ACTIVE_SUBJECTS, validateActiveSubjects } from '@/lib/active-subjects';

describe('active subjects validation', () => {
  it('rejects non-array input', () => {
    const result = validateActiveSubjects('Biology');
    expect('error' in result && result.error).toBe('activeSubjects must be an array');
  });

  it('rejects empty arrays unless allowed', () => {
    const result = validateActiveSubjects([]);
    expect('error' in result && result.error).toBe('activeSubjects must contain at least one subject');

    const allowed = validateActiveSubjects([], { allowEmpty: true });
    expect('value' in allowed && allowed.value).toEqual([]);
  });

  it('rejects arrays larger than the allowed subject list', () => {
    const tooMany = validateActiveSubjects([...ACTIVE_SUBJECTS, ACTIVE_SUBJECTS[0]]);
    expect('error' in tooMany && tooMany.error).toMatch('activeSubjects cannot contain more than');
  });

  it('rejects non-string values', () => {
    const result = validateActiveSubjects([123]);
    expect('error' in result && result.error).toBe('activeSubjects must contain only strings');
  });

  it('rejects invalid subjects', () => {
    const result = validateActiveSubjects(['Physics']);
    expect('error' in result && result.error).toBe("invalid subject: 'Physics'");
  });

  it('rejects duplicate subjects (case-insensitive)', () => {
    const result = validateActiveSubjects(['Biology', 'Biology']);
    expect('error' in result && result.error).toBe('activeSubjects must not contain duplicates');
  });

  it('accepts valid subjects as-is', () => {
    const result = validateActiveSubjects(['Biology', 'Chemistry']);
    expect('value' in result && result.value).toEqual(['Biology', 'Chemistry']);
  });
});
