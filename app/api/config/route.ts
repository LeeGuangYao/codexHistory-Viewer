import { NextResponse } from 'next/server';import { codexHomeExists,getCodexHome } from '@/src/lib/codex/config';
export function GET(){const codexHome=getCodexHome();return NextResponse.json({codexHome,exists:codexHomeExists(codexHome)})}
