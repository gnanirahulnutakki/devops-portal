import { NextResponse } from 'next/server';
import { OPENAPI_SPEC } from '@/lib/openapi';

export const GET = async () => {
  return NextResponse.json(OPENAPI_SPEC);
};
