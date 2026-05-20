import { getCodexHome } from './config';import { parseFiles, scanJsonlFiles } from './parser';
let cache:any=null
export function rescan(override?:string){const home=getCodexHome(override);const files=scanJsonlFiles(home);cache=parseFiles(files);return {success:true,scannedFiles:files.length,parsedLines:Object.values(cache.messagesByThreadId).reduce((a:any,b:any)=>a+b.length,0),failedLines:cache.diagnostics.length,threadCount:cache.threads.length}}
export function getStore(){if(!cache)rescan();return cache}
