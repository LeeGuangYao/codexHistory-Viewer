import { NextResponse } from 'next/server';import { getStore } from '@/src/lib/codex/history-store';
export function GET(){const s=getStore();return NextResponse.json({data:s.threads,diagnostics:s.diagnostics,nextCursor:null})}
