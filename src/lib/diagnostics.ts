import {configured,keyFingerprint,projectUrl,schemaReviewed,supabase} from './backend';
import {tables} from './types';

/**
 * Read-only readiness probe for the real Supabase project.
 *
 * It never writes, never invokes an RPC (RPC invocation can have side effects such as
 * creating a couple), and never exposes a token. It answers one question: which parts of
 * the contract the web client depends on actually exist on the remote project?
 *
 * All requests run in the browser, so this works from any environment that can reach the
 * project, including a machine that has no direct database access.
 */

export type ProbeState='pass'|'fail'|'warn'|'pending'|'skip';
export interface Probe {id:string;label:string;state:ProbeState;detail?:string;}
export interface Report {
 ranAt:string;
 probes:Probe[];
 counts:{pass:number;fail:number;warn:number;skip:number};
 /** Names of remote objects the client needs but the project does not expose. */
 missing:string[];
 auth:{signupDisabled?:boolean;autoconfirm?:boolean;providers?:string[]}|null;
 session:{present:boolean;valid:boolean|null;email?:string};
 specSource:'openapi'|'per-table'|null;
}

/** Every column the web client reads or writes, per table. Keep in sync with src/lib/backend.ts. */
export const tableContract:Record<string,string[]>={
 profiles:['id','name','display_name','avatar_path','birthday','locale','theme'],
 couples:['id','created_at','relationship_date'],
 couple_members:['couple_id','user_id'],
 moods:['id','user_id','couple_id','text','emoji','visibility','title','client_event_id','created_at'],
 mood_reactions:['id','user_id','mood_id','emoji','kind','created_at'],
 care_signals:['id','user_id','couple_id','signal','emoji','text','sender_id','receiver_id','read_at','created_at'],
 memories:['id','user_id','couple_id','title','description','date','photo_path','location','created_at'],
 important_dates:['id','user_id','couple_id','title','date','emoji','repeat_yearly','description','kind','created_by','created_at','visibility','photo_path','repeat_rule'],
 calendar_events:['id','user_id','couple_id','title','date','time','reminder_minutes','description','created_at'],
 diary_entries:['id','user_id','couple_id','title','body','date','photo_path','created_at'],
 cycle_logs:['id','user_id','couple_id','period_start','period_end','cycle_length','symptoms','notes','visibility','created_at'],
 notifications:['id','user_id','type','text','read_at','created_at'],
 notification_preferences:['user_id','moods','reactions','care','dates','memories','diary'],
 push_subscriptions:['id','user_id','endpoint','p256dh','auth','created_at'],
 privacy_settings:['user_id','mood_visibility'],
};

/**
 * Functions called by the client. None of them is defined by any migration in this
 * repository, so each one must already exist on the remote project or be added by a
 * reviewed migration. `args` are the named parameters the client sends.
 */
export const functionContract:{name:string;args:string[];calledBy:string}[]=[
 {name:'active_couple_id',args:[],calledBy:'getContext, saveEntry, uploadImage'},
 {name:'create_couple',args:[],calledBy:'createInvitation'},
 {name:'join_couple',args:['p_code'],calledBy:'joinInvitation'},
 {name:'disconnect_couple',args:[],calledBy:'disconnectCouple'},
 {name:'delete_my_account',args:[],calledBy:'deleteAccount'},
];

/** Private storage buckets used for avatars and shared media. */
export const bucketContract=['avatars','couple-media'];

/** A parsed view of what the remote project exposes. */
export interface RemoteSpec {tables:Record<string,string[]>;functions:string[];}

/** Turns a PostgREST OpenAPI root document into the shape we diff against. Pure. */
export function parseOpenApi(document:unknown):RemoteSpec {
 const spec=document as {definitions?:Record<string,{properties?:Record<string,unknown>}>;paths?:Record<string,unknown>}|null;
 const out:RemoteSpec={tables:{},functions:[]};
 const definitions=spec?.definitions??{};
 for(const [name,definition] of Object.entries(definitions)){
  if(!definition||typeof definition!=='object')continue;
  const properties=definition.properties;
  if(!properties||typeof properties!=='object')continue;
  out.tables[name]=Object.keys(properties);
 }
 for(const path of Object.keys(spec?.paths??{})){
  if(path.startsWith('/rpc/'))out.functions.push(decodeURIComponent(path.slice('/rpc/'.length)));
 }
 return out;
}

export interface ContractDiff {
 missingTables:string[];
 missingColumns:{table:string;column:string}[];
 missingFunctions:{name:string;args:string[];calledBy:string}[];
 unexpectedTables:string[];
}

/** Compares the remote spec with the client contract. Pure so it can be unit tested offline. */
export function diffContract(remote:RemoteSpec,expectedTables:Record<string,string[]>=tableContract):ContractDiff {
 const diff:ContractDiff={missingTables:[],missingColumns:[],missingFunctions:[],unexpectedTables:[]};
 for(const [table,columns] of Object.entries(expectedTables)){
  const actual=remote.tables[table];
  if(!actual){diff.missingTables.push(table);continue;}
  for(const column of columns)if(!actual.includes(column))diff.missingColumns.push({table,column});
 }
 for(const fn of functionContract)if(!remote.functions.includes(fn.name))diff.missingFunctions.push(fn);
 const expected=new Set([...Object.keys(expectedTables),...tables,'invitations','couples','couple_members','profiles']);
 diff.unexpectedTables=Object.keys(remote.tables).filter(name=>!expected.has(name)).sort();
 return diff;
}

interface JsonError {code?:string;message?:string;details?:string;hint?:string;error?:string;statusCode?:string;}

async function readJson(response:Response):Promise<unknown> {
 try{return await response.json();}catch{return null;}
}

function describe(error:unknown):string {
 const value=(error??{}) as JsonError;
 return [value.code,value.message].filter(Boolean).join(': ')||'unexpected response';
}

/** Supabase answers paused projects with an error whose text mentions the pause. */
function pausedDetail(error:unknown):string|null {
 const value=(error??{}) as JsonError;
 return String(value.message??'').toLowerCase().includes('paused')||String(value.code??'').toLowerCase().includes('paused')?'projectPaused':null;
}

async function currentSessionToken():Promise<{token:string|null;email:string|null}> {
 if(!supabase)return {token:null,email:null};
 try{
  const {data}=await supabase.auth.getSession();
  return {token:data.session?.access_token??null,email:data.session?.user?.email??null};
 }catch{return {token:null,email:null};}
}

async function probeAuthSettings(apiKey:string):Promise<{probe:Probe;auth:Report['auth']}> {
 try{
  const response=await fetch(`${projectUrl}/auth/v1/settings`,{headers:{apikey:apiKey},cache:'no-store'});
  const body=await readJson(response) as {disable_signup?:boolean;autoconfirm?:boolean;external?:Record<string,boolean>}|null;
  if(response.status===401||response.status===403)return {probe:{id:'auth',label:'authKey',state:'fail',detail:'invalidApiKey'},auth:null};
  if(!response.ok){const body=await readJson(response);return {probe:{id:'auth',label:'authKey',state:'fail',detail:pausedDetail(body)??`http ${response.status}`},auth:null};}
  const providers=Object.entries(body?.external??{}).filter(([,enabled])=>enabled).map(([name])=>name);
  const auth={signupDisabled:Boolean(body?.disable_signup),autoconfirm:Boolean(body?.autoconfirm),providers};
  const detail=`signup ${auth.signupDisabled?'disabled':'open'} · autoconfirm ${auth.autoconfirm?'on':'off'}${providers.length?` · ${providers.join(',')}`:''}`;
  return {probe:{id:'auth',label:'authKey',state:'pass',detail},auth};
 }catch{
  return {probe:{id:'auth',label:'authKey',state:'fail',detail:'networkError'},auth:null};
 }
}

async function probeSession(apiKey:string,token:string|null,email:string|null):Promise<{probe:Probe;session:Report['session']}> {
 if(!token)return {probe:{id:'session',label:'session',state:'skip',detail:'notLoggedIn'},session:{present:false,valid:null,email:email??undefined}};
 try{
  const response=await fetch(`${projectUrl}/auth/v1/user`,{headers:{apikey:apiKey,Authorization:`Bearer ${token}`},cache:'no-store'});
  if(response.ok)return {probe:{id:'session',label:'session',state:'pass',detail:email??undefined},session:{present:true,valid:true,email:email??undefined}};
  const body=await readJson(response);
  return {probe:{id:'session',label:'session',state:'fail',detail:pausedDetail(body)??`http ${response.status} · ${describe(body)}`},session:{present:true,valid:false,email:email??undefined}};
 }catch{
  return {probe:{id:'session',label:'session',state:'warn',detail:'networkError'},session:{present:true,valid:null,email:email??undefined}};
 }
}

/** Reads the whole exposed schema in one request; no rows are returned and nothing is written. */
async function probeSpec(apiKey:string,token:string|null):Promise<{probe:Probe;spec:RemoteSpec|null;source:Report['specSource']}> {
 const headers:Record<string,string>={apikey:apiKey,Accept:'application/openapi+json'};
 if(token)headers.Authorization=`Bearer ${token}`;
 try{
  const response=await fetch(`${projectUrl}/rest/v1/`,{headers,cache:'no-store'});
  if(!response.ok){
   const body=await readJson(response);
   return {probe:{id:'schema',label:'schema',state:'warn',detail:`http ${response.status} · ${describe(body)}`},spec:null,source:null};
  }
  const spec=parseOpenApi(await readJson(response));
  if(!Object.keys(spec.tables).length&&!spec.functions.length){
   return {probe:{id:'schema',label:'schema',state:'warn',detail:'emptySpec'},spec:null,source:null};
  }
  return {probe:{id:'schema',label:'schema',state:'pass',detail:`${Object.keys(spec.tables).length} tables · ${spec.functions.length} functions`},spec,source:'openapi'};
 }catch{
  return {probe:{id:'schema',label:'schema',state:'fail',detail:'networkError'},spec:null,source:null};
 }
}

/**
 * Fallback when the root spec is unavailable: one read-only `select` per table with `limit=1`.
 * A missing table answers 404/42P01, a missing column answers 400/PGRST205. RLS hides rows, so
 * an empty result still proves the table and columns exist for this role.
 */
async function probeTablesIndividually(apiKey:string,token:string|null):Promise<{probes:Probe[];spec:RemoteSpec|null}> {
 const headers:Record<string,string>={apikey:apiKey};
 if(token)headers.Authorization=`Bearer ${token}`;
 const spec:RemoteSpec={tables:{},functions:[]};
 const probes:Probe[]=[];
 for(const table of Object.keys(tableContract)){
  const columns=tableContract[table].join(',');
  try{
   const response=await fetch(`${projectUrl}/rest/v1/${table}?select=${encodeURIComponent(columns)}&limit=1`,{headers,cache:'no-store'});
   if(response.ok){spec.tables[table]=tableContract[table];probes.push({id:`table:${table}`,label:table,state:'pass'});continue;}
   const body=await readJson(response) as JsonError|null;
   const code=String(body?.code??'');
   const state:ProbeState=code==='42P01'||response.status===404?'fail':code==='42703'||code==='PGRST205'?'warn':'warn';
   probes.push({id:`table:${table}`,label:table,state,detail:describe(body)});
  }catch{
   probes.push({id:`table:${table}`,label:table,state:'warn',detail:'networkError'});
  }
 }
 return {probes,spec:Object.keys(spec.tables).length?spec:null};
}

async function probeBuckets(apiKey:string):Promise<Probe[]> {
 const probes:Probe[]=[];
 for(const bucket of bucketContract){
  const marker=`feelings-probe-${Math.random().toString(36).slice(2)}`;
  try{
   // A HEAD on a non-existent object distinguishes "bucket missing" from "object missing".
   const response=await fetch(`${projectUrl}/storage/v1/object/${bucket}/${marker}`,{method:'HEAD',headers:{apikey:apiKey},cache:'no-store'});
   if(response.status===200){probes.push({id:`bucket:${bucket}`,label:bucket,state:'pass',detail:'publicRead'});continue;}
   const text=await response.text();
   const body=(():JsonError|null=>{try{return JSON.parse(text) as JsonError;}catch{return null;}})();
   const message=String(body?.message??body?.error??text).toLowerCase();
   if(message.includes('bucket not found'))probes.push({id:`bucket:${bucket}`,label:bucket,state:'fail',detail:'bucketNotFound'});
   else if(response.status===400||response.status===404)probes.push({id:`bucket:${bucket}`,label:bucket,state:'pass',detail:'privateBucket'});
   else if(response.status===401||response.status===403)probes.push({id:`bucket:${bucket}`,label:bucket,state:'warn',detail:'needsAuth'});
   else probes.push({id:`bucket:${bucket}`,label:bucket,state:'warn',detail:`http ${response.status}`});
  }catch{
   probes.push({id:`bucket:${bucket}`,label:bucket,state:'warn',detail:'networkError'});
  }
 }
 return probes;
}

/** Runs the full probe and returns a report the UI can render. Never throws. */
export async function probeBackend():Promise<Report> {
 const startedAt=new Date().toISOString();
 const empty:Report={ranAt:startedAt,probes:[],counts:{pass:0,fail:0,warn:0,skip:0},missing:[],auth:null,session:{present:false,valid:null},specSource:null};
 if(!configured||!projectUrl)return {...empty,probes:[{id:'config',label:'config',state:'fail',detail:'configText'}],counts:{pass:0,fail:1,warn:0,skip:0},missing:['config']};
 const apiKey=await resolveApiKey();
 if(!apiKey)return {...empty,probes:[{id:'config',label:'config',state:'fail',detail:'configText'}],counts:{pass:0,fail:1,warn:0,skip:0},missing:['config']};

 const {token,email}=await currentSessionToken();
 const authResult=await probeAuthSettings(apiKey);
 const sessionResult=await probeSession(apiKey,token,email);
 const probes:Probe[]=[authResult.probe,sessionResult.probe];

 let spec:RemoteSpec|null=null;
 let specSource:Report['specSource']=null;
 const specResult=await probeSpec(apiKey,token);
 probes.push(specResult.probe);
 if(specResult.spec){spec=specResult.spec;specSource='openapi';}
 else{
  const fallback=await probeTablesIndividually(apiKey,token);
  probes.push(...fallback.probes);
  if(fallback.spec){spec=fallback.spec;specSource='per-table';}
 }
 probes.push(...(await probeBuckets(apiKey)));

 const missing:string[]=[];
 if(spec){
  const diff=diffContract(spec);
  for(const table of diff.missingTables){missing.push(`table:${table}`);probes.push({id:`table:${table}`,label:table,state:'fail',detail:'missingTable'});}
  for(const {table,column} of diff.missingColumns){missing.push(`column:${table}.${column}`);probes.push({id:`column:${table}.${column}`,label:`${table}.${column}`,state:'fail',detail:'missingColumn'});}
  for(const fn of diff.missingFunctions){
   // Without a logged-in session the anon spec legitimately omits authenticated-only functions.
   const state:ProbeState=token?'fail':'skip';
   missing.push(`function:${fn.name}`);
   probes.push({id:`function:${fn.name}`,label:`${fn.name}()`,state,detail:state==='skip'?'needsLoginToVerify':`called by ${fn.calledBy}`});
  }
 }else{
  for(const fn of functionContract)probes.push({id:`function:${fn.name}`,label:`${fn.name}()`,state:'skip',detail:'specUnavailable'});
 }

 const counts={pass:0,fail:0,warn:0,skip:0};
 for(const probe of probes){
  if(probe.state==='pass')counts.pass++;
  else if(probe.state==='fail')counts.fail++;
  else if(probe.state==='warn')counts.warn++;
  else if(probe.state==='skip')counts.skip++;
 }
 return {ranAt:startedAt,probes,counts,missing:missing.filter(name=>!probes.some(probe=>probe.id===name&&probe.state==='skip')),auth:authResult.auth,session:sessionResult.session,specSource};
}

async function resolveApiKey():Promise<string|null> {
 // keyFingerprint proves a key was loaded without printing it; the header needs the real value.
 if(!keyFingerprint)return null;
 const env=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||import.meta.env.VITE_SUPABASE_ANON_KEY;
 return env||null;
}

/** A short, non-secret summary suitable for copying into an issue or a chat message. */
export function formatReport(report:Report):string {
 const lines=[
  `FEELINGS backend probe @ ${report.ranAt}`,
  `project: ${projectUrl||'—'}`,
  `key: ${keyFingerprint||'not set'} · schemaReviewed: ${schemaReviewed}`,
  `auth: signup ${report.auth?.signupDisabled?'disabled':'open'} · autoconfirm ${report.auth?.autoconfirm?'on':'off'}`,
  `session: ${report.session.present?(report.session.valid===null?'unverified':report.session.valid?'valid':'REJECTED'):'none'}`,
  `spec source: ${report.specSource??'unavailable'}`,
  `counts: pass=${report.counts.pass} fail=${report.counts.fail} warn=${report.counts.warn} skip=${report.counts.skip}`,
  report.missing.length?`missing: ${report.missing.join(', ')}`:'missing: none',
 ];
 for(const probe of report.probes)if(probe.state!=='pass')lines.push(`  [${probe.state}] ${probe.label}${probe.detail?` — ${probe.detail}`:''}`);
 return lines.join('\n');
}
