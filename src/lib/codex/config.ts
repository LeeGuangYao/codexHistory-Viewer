import os from 'node:os';import path from 'node:path';import fs from 'node:fs';
export function getCodexHome(override?:string){const c=override||process.env.CODEX_HOME||'~/.codex';const resolved=c.startsWith('~')?path.join(os.homedir(),c.slice(1)):c;return resolved}
export function codexHomeExists(p:string){return fs.existsSync(p)}
