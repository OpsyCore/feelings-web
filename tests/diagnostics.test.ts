import {describe,it,expect} from 'vitest';
import {diffContract,parseOpenApi,tableContract,functionContract,bucketContract} from '../src/lib/diagnostics';
import {enrichInsertPayload} from '../src/lib/backend';
import {friendlyError} from '../src/lib/validation';
import {messages} from '../src/lib/i18n';

/** A minimal PostgREST root spec shaped like the real one. */
function spec(tables:Record<string,string[]>,functions:string[]){
 return {
  definitions:Object.fromEntries(Object.entries(tables).map(([name,columns])=>[name,{properties:Object.fromEntries(columns.map(column=>[column,{format:'uuid'}]))}])),
  paths:Object.fromEntries([
   ...Object.keys(tables).map(name=>[`/${name}`,{get:{}}]),
   ...functions.map(name=>[`/rpc/${name}`,{post:{}}]),
  ]),
 };
}

const completeTables=()=>Object.fromEntries(Object.entries(tableContract).map(([name,columns])=>[name,[...columns]]));
const completeFunctions=()=>functionContract.map(fn=>fn.name);

describe('backend contract diffing',()=>{
 it('parses tables, columns and rpc paths out of an OpenAPI root document',()=>{
  const parsed=parseOpenApi(spec({profiles:['id','name']},['active_couple_id']));
  expect(parsed.tables.profiles).toEqual(['id','name']);
  expect(parsed.tables.couples).toBeUndefined();
  expect(parsed.functions).toEqual(['active_couple_id']);
 });

 it('reports no gaps when the remote project matches the client contract',()=>{
  const diff=diffContract(parseOpenApi(spec(completeTables(),completeFunctions())));
  expect(diff.missingTables).toEqual([]);
  expect(diff.missingColumns).toEqual([]);
  expect(diff.missingFunctions).toEqual([]);
 });

 it('detects a missing table, a missing column and a missing function separately',()=>{
  const tables=completeTables() as Record<string,string[]>;
  delete tables.cycle_logs;
  tables.moods=(tables.moods??[]).filter(column=>column!=='visibility');
  const functions=completeFunctions().filter(name=>name!=='active_couple_id');
  const diff=diffContract(parseOpenApi(spec(tables,functions)));
  expect(diff.missingTables).toEqual(['cycle_logs']);
  expect(diff.missingColumns).toEqual([{table:'moods',column:'visibility'}]);
  expect(diff.missingFunctions.map(fn=>fn.name)).toEqual(['active_couple_id']);
 });

 it('treats an empty project as missing everything the client needs',()=>{
  const diff=diffContract(parseOpenApi(spec({},[])));
  expect(diff.missingTables.length).toBe(Object.keys(tableContract).length);
  expect(diff.missingFunctions.length).toBe(functionContract.length);
 });

 it('keeps the contract lists honest about what the client actually calls',()=>{
  expect(functionContract.map(fn=>fn.name)).toContain('active_couple_id');
  expect(functionContract.map(fn=>fn.name)).toContain('join_couple');
  expect(bucketContract).toEqual(['avatars','couple-media']);
  for(const columns of Object.values(tableContract))expect(columns).toContain(columns[0]);
 });
});

describe('error categorization for backend failures',()=>{
 it('maps a missing relation or function to the schema category, not a generic failure',()=>{
  expect(friendlyError({code:'42P01',message:'relation "public.profiles" does not exist'})).toBe('schemaMismatch');
  expect(friendlyError({code:'42883',message:'could not find the function public.active_couple_id()'})).toBe('schemaMismatch');
  expect(friendlyError({code:'PGRST205',message:'Could not find the column "visibility"'})).toBe('schemaMismatch');
 });

 it('maps an expired or rejected session to the session category',()=>{
  expect(friendlyError({code:'jwt_expired',message:'JWT expired'})).toBe('sessionExpired');
  expect(friendlyError({code:'refresh_token_not_found',message:'Invalid Refresh Token: Refresh Token Not Found'})).toBe('sessionExpired');
  expect(friendlyError({status:401,message:'unauthorized'})).toBe('sessionExpired');
 });

 it('maps a rejected publishable key to the api key category',()=>{
  expect(friendlyError({code:'invalid_api_key',message:'Invalid API key'})).toBe('invalidApiKey');
 });

 it('maps a paused Supabase project to its own actionable category',()=>{
  expect(friendlyError({status:503,message:'Project is paused'})).toBe('projectPaused');
  expect(friendlyError({code:'project_paused',message:'paused'})).toBe('projectPaused');
 });
 it('maps a 5xx response to the server category and keeps existing categories intact',()=>{
  expect(friendlyError({status:503,message:'upstream down'})).toBe('serverError');
  expect(friendlyError({code:'invalid_credentials',message:'bad'})).toBe('invalidCredentials');
  expect(friendlyError({code:'over_request_rate_limit',message:'slow down'})).toBe('rateLimit');
  expect(friendlyError({message:'couple_full'})).toBe('fullCouple');
  expect(friendlyError({message:'needLogin'})).toBe('needLogin');
 });

 it('has a Persian and an English string for every category it can return',()=>{
  const categories=['schemaMismatch','sessionExpired','invalidApiKey','serverError','projectPaused','permission','duplicate','rateLimit','genericError','networkError'];
  for(const key of categories){
   expect(messages[key],key).toBeDefined();
   expect(messages[key][0],key).toBeTruthy();
   expect(messages[key][1],key).toBeTruthy();
  }
 });
});

describe('insert payload enrichment for the legacy live schema',()=>{
 it('fills moods.title and moods.client_event_id so NOT NULL columns are satisfied',()=>{
  const out=enrichInsertPayload('moods',{text:'خوابم میاد',emoji:'🥱',visibility:'private'},'u1') as Record<string,unknown>;
  expect(out.title).toBe('خوابم میاد');
  expect(String(out.client_event_id).length).toBeGreaterThan(10);
  expect(out.user_id).toBeUndefined();
 });
 it('keeps an explicit title and caps derived titles at 60 characters',()=>{
  const kept=enrichInsertPayload('moods',{text:'x',title:'own'},'u1') as Record<string,unknown>;
  expect(kept.title).toBe('own');
  const long=enrichInsertPayload('moods',{text:'ا'.repeat(50)},'u1') as Record<string,unknown>;
  expect(Array.from(String(long.title)).length).toBeLessThanOrEqual(60);
 });
 it('fills mood_reactions.kind and important_dates.kind/created_by',()=>{
  const reaction=enrichInsertPayload('mood_reactions',{mood_id:'m',emoji:'❤️'},'u1') as Record<string,unknown>;
  expect(reaction.kind).toBe('❤️');
  const date=enrichInsertPayload('important_dates',{title:'تولد',date:'2026-01-01'},'u1') as Record<string,unknown>;
  expect(date.kind).toBe('date');
  expect(date.created_by).toBe('u1');
 });
 it('leaves unrelated tables untouched',()=>{
  const out=enrichInsertPayload('memories',{title:'خاطره'},'u1') as Record<string,unknown>;
  expect(Object.keys(out)).toEqual(['title']);
 });
});
