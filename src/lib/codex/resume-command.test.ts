import { describe,it,expect } from 'vitest';import { getResumeCommand } from './resume-command';
describe('resume',()=>{it('with session',()=>expect(getResumeCommand({sessionId:'123'}).canResume).toBe(true));it('without session',()=>expect(getResumeCommand({}).canResume).toBe(false));})
