import { NextResponse } from 'next/server';import { rescan } from '@/src/lib/codex/history-store';
export function POST(){return NextResponse.json(rescan())}
