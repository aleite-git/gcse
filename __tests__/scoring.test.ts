import { describe, it, expect } from '@jest/globals';

// Test scoring logic

interface Question {
  id: string;
  correctIndex: number;
  topic: string;
}

interface Answer {
  questionId: string;
  selectedIndex: number;
}

interface TopicBreakdown {
  [topic: string]: {
    correct: number;
    total: number;
  };
}

describe('Quiz Scoring', () => {
  // Simulate the scoring logic from the submit endpoint
  function calculateScore(
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

      // Update topic breakdown
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

  const sampleQuestions: Question[] = [
    { id: 'q1', correctIndex: 0, topic: 'CPU' },
    { id: 'q2', correctIndex: 1, topic: 'RAM_ROM' },
    { id: 'q3', correctIndex: 2, topic: 'Storage' },
    { id: 'q4', correctIndex: 3, topic: 'CPU' },
    { id: 'q5', correctIndex: 0, topic: 'Security' },
    { id: 'q6', correctIndex: 1, topic: 'Protocols' },
  ];

  it('should score all correct answers as 6/6', () => {
    const answers: Answer[] = [
      { questionId: 'q1', selectedIndex: 0 },
      { questionId: 'q2', selectedIndex: 1 },
      { questionId: 'q3', selectedIndex: 2 },
      { questionId: 'q4', selectedIndex: 3 },
      { questionId: 'q5', selectedIndex: 0 },
      { questionId: 'q6', selectedIndex: 1 },
    ];

    const result = calculateScore(sampleQuestions, answers);
    expect(result.score).toBe(6);
  });

  it('should score all incorrect answers as 0/6', () => {
    const answers: Answer[] = [
      { questionId: 'q1', selectedIndex: 1 },
      { questionId: 'q2', selectedIndex: 0 },
      { questionId: 'q3', selectedIndex: 0 },
      { questionId: 'q4', selectedIndex: 0 },
      { questionId: 'q5', selectedIndex: 1 },
      { questionId: 'q6', selectedIndex: 0 },
    ];

    const result = calculateScore(sampleQuestions, answers);
    expect(result.score).toBe(0);
  });

  it('should score partial correct answers correctly', () => {
    const answers: Answer[] = [
      { questionId: 'q1', selectedIndex: 0 }, // correct
      { questionId: 'q2', selectedIndex: 0 }, // incorrect
      { questionId: 'q3', selectedIndex: 2 }, // correct
      { questionId: 'q4', selectedIndex: 0 }, // incorrect
      { questionId: 'q5', selectedIndex: 0 }, // correct
      { questionId: 'q6', selectedIndex: 0 }, // incorrect
    ];

    const result = calculateScore(sampleQuestions, answers);
    expect(result.score).toBe(3);
  });

  it('should calculate topic breakdown correctly for all correct', () => {
    const answers: Answer[] = [
      { questionId: 'q1', selectedIndex: 0 },
      { questionId: 'q2', selectedIndex: 1 },
      { questionId: 'q3', selectedIndex: 2 },
      { questionId: 'q4', selectedIndex: 3 },
      { questionId: 'q5', selectedIndex: 0 },
      { questionId: 'q6', selectedIndex: 1 },
    ];

    const result = calculateScore(sampleQuestions, answers);

    expect(result.topicBreakdown['CPU']).toEqual({ correct: 2, total: 2 });
    expect(result.topicBreakdown['RAM_ROM']).toEqual({ correct: 1, total: 1 });
    expect(result.topicBreakdown['Storage']).toEqual({ correct: 1, total: 1 });
    expect(result.topicBreakdown['Security']).toEqual({ correct: 1, total: 1 });
    expect(result.topicBreakdown['Protocols']).toEqual({ correct: 1, total: 1 });
  });

  it('should calculate topic breakdown correctly for partial correct', () => {
    const answers: Answer[] = [
      { questionId: 'q1', selectedIndex: 0 }, // correct (CPU)
      { questionId: 'q2', selectedIndex: 0 }, // incorrect (RAM_ROM)
      { questionId: 'q3', selectedIndex: 2 }, // correct (Storage)
      { questionId: 'q4', selectedIndex: 0 }, // incorrect (CPU)
      { questionId: 'q5', selectedIndex: 1 }, // incorrect (Security)
      { questionId: 'q6', selectedIndex: 1 }, // correct (Protocols)
    ];

    const result = calculateScore(sampleQuestions, answers);

    expect(result.topicBreakdown['CPU']).toEqual({ correct: 1, total: 2 });
    expect(result.topicBreakdown['RAM_ROM']).toEqual({ correct: 0, total: 1 });
    expect(result.topicBreakdown['Storage']).toEqual({ correct: 1, total: 1 });
    expect(result.topicBreakdown['Security']).toEqual({ correct: 0, total: 1 });
    expect(result.topicBreakdown['Protocols']).toEqual({ correct: 1, total: 1 });
  });

  it('should handle questions from same topic', () => {
    const sameTopicQuestions: Question[] = [
      { id: 'q1', correctIndex: 0, topic: 'CPU' },
      { id: 'q2', correctIndex: 1, topic: 'CPU' },
      { id: 'q3', correctIndex: 2, topic: 'CPU' },
      { id: 'q4', correctIndex: 3, topic: 'CPU' },
      { id: 'q5', correctIndex: 0, topic: 'CPU' },
      { id: 'q6', correctIndex: 1, topic: 'CPU' },
    ];

    const answers: Answer[] = [
      { questionId: 'q1', selectedIndex: 0 },
      { questionId: 'q2', selectedIndex: 1 },
      { questionId: 'q3', selectedIndex: 0 },
      { questionId: 'q4', selectedIndex: 3 },
      { questionId: 'q5', selectedIndex: 1 },
      { questionId: 'q6', selectedIndex: 1 },
    ];

    const result = calculateScore(sameTopicQuestions, answers);
    expect(result.score).toBe(4);
    expect(result.topicBreakdown['CPU']).toEqual({ correct: 4, total: 6 });
  });
});
