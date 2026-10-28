import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { resolveProjectRoot } from '../../utils/paths.js';
import { getConfigDir } from '../../config/loader.js';
import { execCommand } from '../../utils/exec.js';
import { runGradle } from '../../utils/gradle.js';
import { resolveTarget } from '../../utils/adb.js';
import { collectGitChanges, type StoredTestCase } from '../../testing-intelligence/changeImpact.js';
import { buildIntelligentPlan } from '../../testing-intelligence/intelligentPlanning.js';
import { diagnoseFailure } from '../../testing-intelligence/failureDiagnosis.js';
import { detectTestPlatform, planSafeTestCommand } from '../../testing-intelligence/safeTestExecution.js';
import { evaluateTestGate } from '../../testing-intelligence/testGate.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import type { ToolModule } from '../types.js';
export const toolName='run_autonomous_test_cycle'; export const workflow='testing-intelligence';
async function getGitHeadSha(root:string):Promise<string|null>{try{const r=await execCommand('git',['rev-parse','HEAD'],{cwd:root,timeoutMs:5000});const sha=r.stdout.trim();return r.exitCode===0&&/^[a-f0-9]{40,64}$/i.test(sha)?sha:null;}catch{return null;}}
function redact(value:string):string { return value.replace(/(password|passwd|secret|token|api[_-]?key|authorization|cookie|credential)\s*[:=]\s*[^\s,;]+/gi,'$1=[REDACTED]').replace(/Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi,'Bearer [REDACTED]').replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,})\b/g,'[REDACTED]'); }
async function loadCases(dir:string):Promise<StoredTestCase[]> { const cases:StoredTestCase[]=[]; try { for(const file of (await fs.readdir(dir)).filter(n=>n.endsWith('.json')).sort()) { try { const v:unknown=JSON.parse(await fs.readFile(path.join(dir,file),'utf8')); if(v&&typeof v==='object'&&!Array.isArray(v)) cases.push({...v as StoredTestCase,file:path.join(dir,file)}); } catch { /* ignore malformed case */ } } } catch(e) { if((e as NodeJS.ErrnoException).code!=='ENOENT') throw e; } return cases; }
export function register(server:McpServer) {
 return server.registerTool(toolName,{title:'Run Autonomous Testing Cycle',description:'Coordinate change discovery, explainable test selection, safe project-native test execution, failure diagnosis, immutable attempt evidence, and a strict test gate. Preview is default; execute=true explicitly opts into running the selected Flutter or Gradle suite. Retries are bounded and only proposed for transient failures when the caller opts in.',inputSchema:{request:z.string().min(3).max(4000),projectPath:z.string().optional(),base:z.string().optional(),platform:z.enum(['flutter','android-gradle']).optional(),suite:z.enum(['unit','integration']).optional().default('unit'),module:z.string().optional(),variant:z.string().optional().default('debug'),targetId:z.string().optional(),execute:z.boolean().optional().default(false),timeoutMs:z.number().int().min(1000).max(1800000).optional().default(900000),maxRetries:z.number().int().min(0).max(2).optional().default(0)},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false}},withErrorHandling(async(args:{request:string;projectPath?:string;base?:string;platform?:'flutter'|'android-gradle';suite?:'unit'|'integration';module?:string;variant?:string;targetId?:string;execute?:boolean;timeoutMs?:number;maxRetries?:number})=>{
   const root=args.projectPath?path.resolve(args.projectPath):resolveProjectRoot(path.resolve(process.cwd())); const config=getConfigDir(root);
   let changes; const warnings:string[]=[];
   try { changes=await collectGitChanges(root,args.base??'HEAD~1'); } catch(e) { warnings.push('Git change context unavailable: '+(e instanceof Error?e.message:String(e))); changes={changedFiles:[],base:args.base??'HEAD~1',head:'unknown',selectedSuites:['broad-regression'],fallbackToBroadRun:true,rationale:['Git change context unavailable; broad regression recommended.']}; }
   const testCases=await loadCases(path.join(config,'testcases'));
   const plan=buildIntelligentPlan({request:args.request,changedFiles:changes.changedFiles,testCases,maxTestCases:10});
   const platform=args.platform??detectTestPlatform(root); const commandPlan=planSafeTestCommand({projectRoot:root,platform,suite:args.suite??'unit',targetId:args.targetId,module:args.module,variant:args.variant??'debug'});
   if(!args.execute) { const result={mode:'plan-only',status:'ready-for-review',projectRoot:root,request:args.request,changeSummary:{changedFiles:changes.changedFiles,selectedSuites:changes.selectedSuites,fallbackToBroadRun:changes.fallbackToBroadRun},testPlan:plan,commandPlan,warnings,executionRequires:'Review the project root, selected suite, and command plan, then set execute=true to run.'}; return textResult(JSON.stringify(result,null,2),result); }
   let target:Awaited<ReturnType<typeof resolveTarget>>|undefined;
   if((args.suite??'unit')==='integration') target=await resolveTarget({requestedId:args.targetId});
   const attempts:Array<{attempt:number;status:'passed'|'failed'|'blocked';exitCode:number|null;durationMs:number;error?:string;stdout:string;stderr:string;diagnosis?:ReturnType<typeof diagnoseFailure>}>= [];
   const maxRetries=args.maxRetries??0; const startedAt=new Date().toISOString();
   for(let attempt=1;attempt<=maxRetries+1;attempt++) {
     const start=Date.now(); let exitCode:number|null=null; let stdout=''; let stderr=''; let errorText=''; let environmentFailure=false;
     try {
       if(commandPlan.platform==='flutter') {
         const argv=(args.suite??'unit')==='unit'?['test']:['test','-d',target!.id,'integration_test'];
         const r=await execCommand(process.env.FLUTTER_PATH||'flutter',argv,{cwd:root,timeoutMs:args.timeoutMs??900000}); exitCode=r.exitCode; stdout=r.stdout; stderr=r.stderr;
       } else {
         const module=(args.module??'').trim().replace(/^:+|:+$/g,''); const prefix=module?':'+module+':':''; const variant=args.variant??'debug'; const cap=variant[0]!.toUpperCase()+variant.slice(1);
         const task=(args.suite??'unit')==='unit'?'test'+cap+'UnitTest':'connected'+cap+'AndroidTest';
         const r=await runGradle(root,[prefix+task],{timeoutMs:args.timeoutMs??900000,env:target?{ANDROID_SERIAL:target.id}:undefined}); exitCode=r.exitCode; stdout=r.stdout; stderr=r.stderr;
       }
     } catch(e) { const err=e as {message?:string;details?:Record<string,unknown>}; errorText=err.message??String(e); const details=err.details??{}; exitCode=typeof details.exitCode==='number'?details.exitCode:null; stdout=typeof details.stdout==='string'?details.stdout:''; stderr=typeof details.stderr==='string'?details.stderr:''; environmentFailure=/not found|not installed|no such file|sdk location|no devices|device.*not found|cannot find|no (connected )?(target|emulator|device)|multiple targets|target offline|target unauthorized|not in state/i.test(errorText); }
     const status=environmentFailure?'blocked':exitCode===0?'passed':'failed'; const combined=redact([errorText,stderr,stdout].join('\n')).slice(-40000);
     const diagnosis=status==='passed'?undefined:diagnoseFailure({status,error:combined,attempt,maxRetries,readOnly:true});
     attempts.push({attempt,status,exitCode,durationMs:Date.now()-start,...(errorText?{error:redact(errorText)}:{}),stdout:redact(stdout).slice(-20000),stderr:redact(stderr).slice(-20000),...(diagnosis?{diagnosis}:{})});
     if(status==='passed'||status==='blocked'||!diagnosis?.retryAllowed) break;
   }
   const final=attempts[attempts.length-1]!; const gate=evaluateTestGate({status:final.status==='passed'?'passed':final.status==='blocked'?'incomplete':'failed',testCount:1,passed:final.status==='passed'?1:0,failed:final.status==='failed'?1:0,skipped:final.status==='blocked'?1:0});
   const now=new Date(); const date=now.toISOString().slice(0,10); const time=now.toISOString().slice(11,19).replace(/:/g,''); const reportDir=path.join(config,'test-reports',date,time+'-autonomous-'+randomUUID().slice(0,8)); await fs.mkdir(reportDir,{recursive:true});
   const command=commandPlan.executable+' '+commandPlan.args.join(' '); const safeAttempts=attempts.map(a=>({...a,stdout:a.stdout.slice(-20000),stderr:a.stderr.slice(-20000)}));
   const gitHeadSha=await getGitHeadSha(root); if(!gitHeadSha) warnings.push('Git HEAD SHA unavailable; this run cannot provide commit-bound test evidence.');
   const summary={schemaVersion:1,workflow:'autonomous-test-cycle',request:args.request,projectRoot:root,startedAt,completedAt:new Date().toISOString(),gitHeadSha,platform:commandPlan.platform,suite:commandPlan.suite,command,mode:'execute',status:final.status==='passed'?'passed':final.status==='blocked'?'incomplete':'failed',gate,changeSummary:{changedFiles:changes.changedFiles,selectedSuites:changes.selectedSuites,fallbackToBroadRun:changes.fallbackToBroadRun},testPlan:plan,attempts:safeAttempts,selectedSavedTestCases:plan.selected,warnings,policy:{originalFailuresPreserved:true,maxRetries,deviceE2EClaimed:commandPlan.requiresDevice&&final.status==='passed',note:'The selected project-native suite was executed. Saved test-case matches are recommendations and are not separately executed by this command.'}};
   const summaryJson=path.join(reportDir,'summary.json'); const summaryMd=path.join(reportDir,'summary.md'); const log=path.join(reportDir,'command.log');
   await Promise.all([fs.writeFile(summaryJson,JSON.stringify(summary,null,2)+'\n',{encoding:'utf8',flag:'wx'}),fs.writeFile(summaryMd,['# Autonomous Test Cycle','','- **Status:** '+summary.status.toUpperCase(),'- **Gate:** '+gate.decision,'- **Request:** '+args.request,'- **Command:** '+command,'- **Attempts:** '+attempts.length,'- **Selected saved test cases (not executed by this command):** '+plan.selected.length,'','## Attempt results',...attempts.map(a=>'- **'+a.status.toUpperCase()+'** attempt '+a.attempt+'; exit code '+a.exitCode+(a.error?'; '+a.error:'')),'','## Coverage gaps',...(plan.unmappedChangedFiles.length?plan.unmappedChangedFiles.map(f=>'- Unmapped: '+f):['- None reported by the planner.']),'','## Warnings',...(warnings.length?warnings.map(w=>'- '+w):['- None']),'','> The gate only passes on an explicit successful runner exit. A passing suite does not prove device-level end-to-end coverage unless the integration suite was actually run on a ready device.',''].join('\n'),{encoding:'utf8',flag:'wx'}),fs.writeFile(log,['COMMAND: '+command,...attempts.flatMap(a=>['\nATTEMPT '+a.attempt+' STATUS '+a.status+' EXIT '+a.exitCode,'--- STDOUT ---',a.stdout,'--- STDERR ---',a.stderr,a.error??''])].join('\n'),{encoding:'utf8',flag:'wx'})]);
   const result={...summary,summaryJson:path.relative(root,summaryJson).split(path.sep).join('/'),summaryMarkdown:path.relative(root,summaryMd).split(path.sep).join('/'),commandLog:path.relative(root,log).split(path.sep).join('/')};
   return textResult(JSON.stringify(result,null,2),result as unknown as Record<string,unknown>);
 }));
}
const mod:ToolModule={toolName,workflow,register}; export default mod;
