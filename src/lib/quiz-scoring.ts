import { Answer, TopicBreakdown, Question } from '@/types';

/**
 * Calculate score and topic breakdown from questions and answers
 */
export function calculateScore(
  questions: Question[],
  answers: Answer[]
): { score: number; topicBreakdown: TopicBreakdown } {
  let score = 0;
  const topicBreakdown: TopicBreakdown = {};

  for (const question of questions) {
    const answer = answers.find((a) => a.questionId === question.id);
    const isCorrect = answer?.selectedIndex === question.correctIndex;

    if (isCorrect) {
      score++;
    }

    if (!topicBreakdown[question.topic]) {
      topicBreakdown[question.topic] = { correct: 0, total: 0 };
    }
    topicBreakdown[question.topic].total++;
    if (isCorrect) {
      topicBreakdown[question.topic].correct++;
    }
  }

  return { score, topicBreakdown };
}

/**
 * Validate quiz submission answers against assigned question IDs
 */
export function validateSubmission(
  answers: Array<{ questionId: string; selectedIndex: number }>,
  assignedQuestionIds: string[]
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (answers.length !== assignedQuestionIds.length) {
    errors.push(`Must answer all ${assignedQuestionIds.length} questions`);
  }

  for (const answer of answers) {
    if (!answer.questionId || typeof answer.selectedIndex !== 'number') {
      errors.push('Invalid answer format');
      break;
    }

    if (answer.selectedIndex < 0 || answer.selectedIndex > 3) {
      errors.push('Invalid answer selection');
      break;
    }
  }

  const assignedIds = new Set(assignedQuestionIds);
  for (const answer of answers) {
    if (!assignedIds.has(answer.questionId)) {
      errors.push(`Question ${answer.questionId} is not part of today's quiz`);
      break;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
