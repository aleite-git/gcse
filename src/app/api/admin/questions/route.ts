import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getAllQuestions, addQuestion, bulkImportQuestions } from '@/lib/questions';
import { QuestionInput } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session?.isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const questions = await getAllQuestions();
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
      const count = await bulkImportQuestions(body.questions as QuestionInput[]);
      return NextResponse.json({ success: true, imported: count });
    }

    // Single question add
    const questionInput = body as QuestionInput;

    // Validate
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
