import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getAllQuestions, addQuestion, bulkImportQuestions } from '@/lib/questions';
import { QuestionInput, Subject, SUBJECTS } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session?.isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Optional subject filtering
    const { searchParams } = new URL(request.url);
    const subject = searchParams.get('subject') as Subject | null;

    // Validate subject if provided
    if (subject && !SUBJECTS[subject]) {
      return NextResponse.json(
        { error: 'Invalid subject' },
        { status: 400 }
      );
    }

    const questions = await getAllQuestions(subject || undefined);
    return NextResponse.json({ questions });
  } catch (error) {
    console.error('Error getting questions:', error);
    return NextResponse.json(
      { error: 'Failed to get questions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session?.isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Check if bulk import
    if (body.questions && Array.isArray(body.questions)) {
      // Validate subject on all questions
      for (const q of body.questions) {
        if (!q.subject || !SUBJECTS[q.subject as Subject]) {
          return NextResponse.json(
            { error: 'All questions must have a valid subject' },
            { status: 400 }
          );
        }
      }
      const count = await bulkImportQuestions(body.questions as QuestionInput[]);
      return NextResponse.json({ success: true, imported: count });
    }

    // Single question add
    const questionInput = body as QuestionInput;

    // Validate subject
    if (!questionInput.subject || !SUBJECTS[questionInput.subject]) {
      return NextResponse.json(
        { error: 'Valid subject is required' },
        { status: 400 }
      );
    }

    // Validate other fields
    if (!questionInput.stem || !questionInput.options || !questionInput.explanation) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (questionInput.options.length !== 4) {
      return NextResponse.json(
        { error: 'Must have exactly 4 options' },
        { status: 400 }
      );
    }

    if (
      questionInput.correctIndex === undefined ||
      questionInput.correctIndex < 0 ||
      questionInput.correctIndex > 3
    ) {
      return NextResponse.json(
        { error: 'Invalid correct index' },
        { status: 400 }
      );
    }

    const id = await addQuestion(questionInput);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Error adding question:', error);
    return NextResponse.json(
      { error: 'Failed to add question' },
      { status: 500 }
    );
  }
}
