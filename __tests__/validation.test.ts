import { describe, it, expect } from '@jest/globals';
import { validateSubmission } from '@/lib/quiz-scoring';

describe('Quiz Submission Validation', () => {
  const validQuestionIds = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'];

  it('should accept valid submission with 6 answers', () => {
    const answers = [
      { questionId: 'q1', selectedIndex: 0 },
      { questionId: 'q2', selectedIndex: 1 },
      { questionId: 'q3', selectedIndex: 2 },
      { questionId: 'q4', selectedIndex: 3 },
      { questionId: 'q5', selectedIndex: 0 },
      { questionId: 'q6', selectedIndex: 1 },
    ];

    const result = validateSubmission(answers, validQuestionIds);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject submission with fewer than 6 answers', () => {
    const answers = [
      { questionId: 'q1', selectedIndex: 0 },
      { questionId: 'q2', selectedIndex: 1 },
      { questionId: 'q3', selectedIndex: 2 },
    ];

    const result = validateSubmission(answers, validQuestionIds);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Must answer all 6 questions');
  });

  it('should reject submission with more than 6 answers', () => {
    const answers = [
      { questionId: 'q1', selectedIndex: 0 },
      { questionId: 'q2', selectedIndex: 1 },
      { questionId: 'q3', selectedIndex: 2 },
      { questionId: 'q4', selectedIndex: 3 },
      { questionId: 'q5', selectedIndex: 0 },
      { questionId: 'q6', selectedIndex: 1 },
      { questionId: 'q7', selectedIndex: 2 },
    ];

    const result = validateSubmission(answers, validQuestionIds);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Must answer all 6 questions');
  });

  it('should reject submission with invalid selectedIndex (negative)', () => {
    const answers = [
      { questionId: 'q1', selectedIndex: -1 },
      { questionId: 'q2', selectedIndex: 1 },
      { questionId: 'q3', selectedIndex: 2 },
      { questionId: 'q4', selectedIndex: 3 },
      { questionId: 'q5', selectedIndex: 0 },
    ];

    const result = validateSubmission(answers, validQuestionIds);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid answer selection');
  });

  it('should reject submission with invalid selectedIndex (>3)', () => {
    const answers = [
      { questionId: 'q1', selectedIndex: 0 },
      { questionId: 'q2', selectedIndex: 4 },
      { questionId: 'q3', selectedIndex: 2 },
      { questionId: 'q4', selectedIndex: 3 },
      { questionId: 'q5', selectedIndex: 0 },
    ];

    const result = validateSubmission(answers, validQuestionIds);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid answer selection');
  });

  it('should reject submission with question not in assignment', () => {
    const answers = [
      { questionId: 'q1', selectedIndex: 0 },
      { questionId: 'q2', selectedIndex: 1 },
      { questionId: 'q3', selectedIndex: 2 },
      { questionId: 'q4', selectedIndex: 3 },
      { questionId: 'invalid-question', selectedIndex: 0 },
      { questionId: 'q6', selectedIndex: 1 },
    ];

    const result = validateSubmission(answers, validQuestionIds);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('not part of today\'s quiz');
  });

  it('should reject empty submission', () => {
    const answers: Array<{ questionId: string; selectedIndex: number }> = [];

    const result = validateSubmission(answers, validQuestionIds);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Must answer all 6 questions');
  });

  it('should reject submissions that do not match the assigned question count', () => {
    const assigned = ['q1', 'q2', 'q3', 'q4'];
    const answers = [
      { questionId: 'q1', selectedIndex: 0 },
      { questionId: 'q2', selectedIndex: 1 },
      { questionId: 'q3', selectedIndex: 2 },
    ];

    const result = validateSubmission(answers, assigned);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Must answer all 4 questions');
  });
});
