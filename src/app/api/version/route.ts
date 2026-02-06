import { NextResponse } from 'next/server';
import packageJson from '../../../../package.json';

export async function GET() {
  return NextResponse.json({
    version: packageJson.version,
    commit: process.env.COMMIT_SHA || null,
  });
}
