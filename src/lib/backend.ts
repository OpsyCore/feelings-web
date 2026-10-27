import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';
import type { Couple, Entry, EntryInput, Invitation, Profile, Table } from './types';
import { normalizeCode, validCode, validImage, validateMood } from './validation';
const PROJECT_URL='https://wsyfeitsqrxmvrjrghey.supabase.co';
/**
 * Browser-safe publishable key for project wsyfeitsqrxmvrjrghey, identical to .env.example.
 * It is public by design (Supabase publishable keys ship inside client bundles); it grants
 * nothing beyond the anonymous role. VITE_* variables always override these fallbacks so a
 * deployment can point at another project or rotate keys without touching source.
 */
const PROJECT_PUBLISHABLE_KEY='sb_publishable_yutqaxOvWfY3ESICUR9XVw_9Gfow9r4';
const url=(import.meta.env.VITE_SUPABASE_URL || PROJECT_URL).replace(/\/+$/,'');
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || PROJECT_PUBLISHABLE_KEY;
export const projectUrl=url;
export const configured=Boolean(url && key);
/** Defaults to the value committed in .env.example; set the variable to 'false' to block data ops. */
const schemaFlag=import.meta.env.VITE_SUPABASE_SCHEMA_REVIEWED;
export const schemaReviewed=schemaFlag===undefined?true:schemaFlag==='true';
// A non-secret fingerprint so the operator can compare the loaded key with the dashboard value.
export const keyFingerprint=key?`${key.slice(0,16)}…${key.slice(-4)} · ${key.length} chars`:'';
export const supabase=configured ? createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}}) : null;
export interface ConnectionCheck {ok:boolean;message:string;}
// Diagnoses the browser->Supabase link without exposing tokens: an unauthenticated call to the
// public auth settings endpoint answers 200 only when the project URL and API key are both valid.
export async function checkConnection():Promise<ConnectionCheck> {
 if(!url)return {ok:false,message:'configText'};
 if(!key)return {ok:false,message:'configText'};
 try{
  const response=await fetch(`${url}/auth/v1/settings`,{headers:{apikey:key},cache:'no-store'});
  if(response.status===401||response.status===403)return {ok:false,message:'invalidApiKey'};
  if(response.status===404)return {ok:false,message:'wrongProjectUrl'};
  if(!response.ok)return {ok:false,message:'connectionFailed'};
  return {ok:true,message:schemaReviewed?'connected':'schemaBlocked'};
 }catch{
  return {ok:false,message:'networkError'};
 }
}
export function client(dataOperation=true) {if(!supabase) throw new Error('configText');if(!navigator.onLine)throw new Error('offline');if(dataOperation&&!schemaReviewed)throw new Error('schemaBlocked');return supabase;}
/**
 * A single refresh loaded up to eleven authenticated resources, and each of them called
 * auth.getUser() again: eleven round trips to GoTrue per refresh, repeated on every focus,
 * reconnect and realtime change. That is slow and can trip Supabase's auth rate limiter,
 * which surfaces to the user as an unexplained refresh failure. The identity is now resolved
 * once per access token and reused; the cache key changes whenever the token is refreshed.
 */
const IDENTITY_TTL_MS=30_000;
let identityCache:{token:string;user:User;at:number}|null=null;
/** Drops the cached identity. Must be called on every auth state change. */
export function clearIdentityCache(){identityCache=null;}
export async function identity():Promise<User> {
 const db=client();
 const {data:{session},error:sessionError}=await db.auth.getSession();
 if(sessionError)throw sessionError;
 if(!session?.user)throw new Error('needLogin');
 const token=session.access_token;
 if(identityCache&&identityCache.token===token&&Date.now()-identityCache.at<IDENTITY_TTL_MS)return identityCache.user;
 const {data,error}=await db.auth.getUser(token);
 if(error)throw error;
 if(!data.user)throw new Error('needLogin');
 identityCache={token,user:data.user,at:Date.now()};
 return data.user;
}
export async function getContext():Promise<{profile:Profile|null;couple:Couple|null}> {
 const user=await identity(); const db=client();
 let profileResult=await db.from('profiles').select('*').eq('id',user.id).maybeSingle();
 if(profileResult.error)throw profileResult.error;
 if(!profileResult.data){const metadataName=typeof user.user_metadata?.name==='string'?user.user_metadata.name.trim():'';if(metadataName){await saveProfile({name:metadataName});profileResult=await db.from('profiles').select('*').eq('id',user.id).maybeSingle();if(profileResult.error)throw profileResult.error;}}
 const active=await db.rpc('active_couple_id');if(active.error)throw active.error;const coupleId=active.data as string|null;
 if(!coupleId)return {profile:profileResult.data as Profile|null,couple:null};
 const coupleResult=await db.from('couples').select('*').eq('id',coupleId).maybeSingle();if(coupleResult.error)throw coupleResult.error;
 const members=await db.from('couple_members').select('user_id').eq('couple_id',coupleId).neq('user_id',user.id).limit(1);if(members.error)throw members.error;const partnerId=members.data?.[0]?.user_id as string|undefined;let partner:Profile|undefined;
 if(partnerId){const p=await db.from('profiles').select('id,name,avatar_path,locale,theme').eq('id',partnerId).maybeSingle();if(!p.error)partner=p.data as Profile|undefined;}
 return {profile:profileResult.data as Profile|null,couple:coupleResult.data?{...(coupleResult.data as Couple),partner}:null};
}
export async function listEntries(table:Table,coupleId?:string,offset=0):Promise<Entry[]> {const user=await identity();let query=client().from(table).select('*').order('created_at',{ascending:false}).range(offset,offset+29);if(table==='notifications')query=query.eq('user_id',user.id);else if(table==='cycle_logs'||table==='moods')query=coupleId?query.or(`user_id.eq.${user.id},and(couple_id.eq.${coupleId},visibility.eq.partner)`):query.eq('user_id',user.id);else if(!coupleId)return [];else query=query.eq('couple_id',coupleId);const {data,error}=await query;if(error)throw error;return (data??[]) as Entry[];}
/**
 * The live schema predates the web client and enforces legacy NOT NULL columns that the
 * web payloads never carried: moods.title and moods.client_event_id, mood_reactions.kind
 * and important_dates.kind/created_by. Inserts therefore failed at the database even
 * though every product field was valid. Fill them deterministically on insert so web
 * writes satisfy the existing contract without waiting for a migration. Pure + tested.
 */
export function enrichInsertPayload(table:Table,payload:Record<string,unknown>,userId:string):Record<string,unknown> {
 const out:Record<string,unknown>={...payload};
 if(table==='moods'){
  if(out.client_event_id===undefined)out.client_event_id=crypto.randomUUID();
  if(!out.title)out.title=String(out.text??out.emoji??'').slice(0,60)||'—';
 }else if(table==='mood_reactions'){
  if(!out.kind)out.kind=String(out.emoji??'reaction');
 }else if(table==='important_dates'){
  if(!out.kind)out.kind='date';
  if(!out.created_by)out.created_by=userId;
  if(out.repeat_rule===undefined)out.repeat_rule=out.repeat_yearly?'yearly':'none';
 }
 return out;
}
const editable:Record<Table,(keyof EntryInput)[]>={moods:['text','emoji','visibility'],mood_reactions:['mood_id','emoji'],care_signals:['signal','emoji','text','receiver_id'],memories:['title','description','date','photo_path','location'],important_dates:['title','date','emoji','repeat_yearly','description','visibility','photo_path'],calendar_events:['title','date','time','reminder_minutes','description'],diary_entries:['title','body','date','photo_path'],cycle_logs:['period_start','period_end','cycle_length','symptoms','notes','visibility'],notifications:[]};
export async function saveEntry(table:Table,input:EntryInput,id?:string):Promise<Entry> {const user=await identity();const db=client();const acknowledgement=table==='care_signals'&&Boolean(id);const fields=acknowledgement?['read_at']:editable[table];if(table==='notifications')throw new Error('permission');if(table==='moods'&&input.text!==undefined){const issue=validateMood(input.text);if(issue)throw new Error(issue);}const payload=Object.fromEntries(Object.entries(input).filter(([key])=>fields.includes(key as keyof EntryInput)));if(table==='important_dates'&&payload.repeat_yearly!==undefined&&payload.repeat_rule===undefined)payload.repeat_rule=payload.repeat_yearly?'yearly':'none';
 if(!id){const {data:activeId,error}=await db.rpc('active_couple_id');if(error)throw error;const coupleId=activeId as string|null;const personal=table==='moods'||table==='cycle_logs';if(!personal&&!coupleId)throw new Error('needPartner');if(input.visibility==='partner'){if(!coupleId)throw new Error('needPartner');const member=await db.from('couple_members').select('user_id').eq('couple_id',coupleId).neq('user_id',user.id).limit(1);if(member.error)throw member.error;if(!member.data?.[0]?.user_id)throw new Error('needPartner');}if(input.couple_id&&input.couple_id!==coupleId)throw new Error('permission');if(coupleId)payload.couple_id=coupleId;payload.user_id=user.id;Object.assign(payload,enrichInsertPayload(table,payload,user.id));if(table==='care_signals'){if(!coupleId)throw new Error('needPartner');const member=await db.from('couple_members').select('user_id').eq('couple_id',coupleId).neq('user_id',user.id).limit(1);if(member.error)throw member.error;const partnerId=member.data?.[0]?.user_id;if(!partnerId||input.receiver_id!==partnerId)throw new Error('needPartner');payload.sender_id=user.id;}}
 let query;if(id)query=db.from(table).update(payload).eq('id',id).eq(acknowledgement?'receiver_id':'user_id',user.id);else query=db.from(table).insert(payload);const {data,error}=await query.select().single();if(error)throw error;return data as Entry;}
export async function removeEntry(table:Table,id:string) {const user=await identity();const {data,error}=await client().from(table).delete().eq('id',id).eq('user_id',user.id).select('id');if(error)throw error;if(!data?.length)throw new Error('permission');}
export async function fetchPendingInvitation():Promise<Invitation|null> {await identity();const {data:cid,error:e1}=await client().rpc('active_couple_id');if(e1)throw e1;if(!cid)return null;const {data:row,error:e2}=await client().from('couples').select('invite_code,invite_expires_at,status').eq('id',cid as string).maybeSingle();if(e2)throw e2;if(!row||row.status!=='pending'||!row.invite_code)return null;const {count,error:e3}=await client().from('couple_members').select('user_id',{count:'exact',head:true}).eq('couple_id',cid as string);if(e3)throw e3;if(count!==1)return null;return {code:String(row.invite_code),expires_at:String(row.invite_expires_at)};}
export async function ownSoloPendingCouple():Promise<boolean> {const invite=await fetchPendingInvitation().catch(()=>null);if(!invite)return false;const user=await identity();const {data:cid}=await client().rpc('active_couple_id');if(!cid)return false;const {data:row}=await client().from('couples').select('created_by').eq('id',cid as string).maybeSingle();return row?.created_by===user.id;}
export async function createInvitation():Promise<Invitation> {await identity();const {data,error}=await client().rpc('create_couple');if(error){if(String(error.message).includes('already in a couple')){const existing=await fetchPendingInvitation();if(existing)return existing;}throw error;}const row=(Array.isArray(data)?data[0]:data) as Record<string,unknown>|null;const code=String(row?.code ?? row?.invite_code ?? '');const expires=String(row?.expires_at ?? row?.invite_expires_at ?? '');if(!/^\d{6}$/.test(code)||!expires)throw new Error('invite_not_available');return {code,expires_at:expires};}
export async function joinInvitation(code:string) {if(!validCode(code))throw new Error('invalidCode');await identity();const {error}=await client().rpc('join_couple',{p_code:normalizeCode(code)});if(error)throw error;}
export async function disconnectCouple(){await identity();const {error}=await client().rpc('disconnect_couple');if(error)throw error;}
export async function uploadImage(file:File,scope:string,bucket='couple-media') {if(!validImage(file))throw new Error('uploadError');const user=await identity();if(bucket==='avatars'&&scope!==user.id)throw new Error('permission');if(bucket==='couple-media'){const {data,error}=await client().rpc('active_couple_id');if(error)throw error;if(!data||data!==scope)throw new Error('permission');}const path=`${scope}/${user.id}/${crypto.randomUUID()}.${file.type.split('/')[1]}`;const {error}=await client().storage.from(bucket).upload(path,file,{upsert:false,contentType:file.type});if(error)throw error;return path;}
export async function signedImage(path:string,bucket='couple-media') {const {data,error}=await client().storage.from(bucket).createSignedUrl(path,1800);if(error)throw error;return data.signedUrl;}
export interface CycleDay {id?:string;user_id?:string;couple_id?:string|null;log_date:string;flow:'none'|'spotting'|'light'|'medium'|'heavy';pain:number;energy:number;mood?:string|null;symptoms:string[];sleep_hours?:number|null;medicines?:string|null;notes?:string|null;visibility:'private'|'partner';created_at?:string;}
export interface CycleSettings {period_reminder:boolean;reminder_days_before:number;daily_checkin_reminder:boolean;reminder_time:string;partner_default:boolean;}
export async function listCycleDays(from:string,to:string):Promise<CycleDay[]>{const user=await identity();const db=client();const active=await db.rpc('active_couple_id');if(active.error)throw active.error;let query=db.from('cycle_daily_logs').select('*').gte('log_date',from).lte('log_date',to);query=active.data?query.or(`user_id.eq.${user.id},and(couple_id.eq.${active.data},visibility.eq.partner)`):query.eq('user_id',user.id);const {data,error}=await query.order('log_date');if(error)throw error;return (data??[]) as CycleDay[];}
export async function saveCycleDay(input:CycleDay):Promise<CycleDay>{const user=await identity();const active=await client().rpc('active_couple_id');if(active.error)throw active.error;const payload={...input,user_id:user.id,couple_id:active.data||null};delete (payload as {id?:string}).id;const {data,error}=await client().from('cycle_daily_logs').upsert(payload,{onConflict:'user_id,log_date'}).select().single();if(error)throw error;return data as CycleDay;}
export async function getCycleSettings():Promise<CycleSettings>{const user=await identity();const {data,error}=await client().from('cycle_settings').select('*').eq('user_id',user.id).maybeSingle();if(error)throw error;return (data??{period_reminder:false,reminder_days_before:2,daily_checkin_reminder:false,reminder_time:'20:00',partner_default:false}) as CycleSettings;}
export async function saveCycleSettings(input:CycleSettings){const user=await identity();const {error}=await client().from('cycle_settings').upsert({...input,user_id:user.id,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error)throw error;}
export async function saveProfile(input:Partial<Profile>){const user=await identity();const name=typeof input.name==='string'?input.name.trim():'';const payload:Record<string,unknown>={id:user.id};if(name){payload.name=name;payload.display_name=name;}if(input.avatar_path!==undefined)payload.avatar_path=input.avatar_path;if(input.birthday!==undefined)payload.birthday=input.birthday;if(input.language!==undefined)payload.locale=input.language;if(input.locale!==undefined)payload.locale=input.locale;if(input.theme!==undefined)payload.theme=input.theme;const {data,error}=await client().from('profiles').upsert(payload,{onConflict:'id'}).select('*').single();if(error)throw error;return data as Profile;}
export const VAPID_PUBLIC_KEY='BJLOcISzkqnj4Oq2h4gOP1DKkdTtwQegYqu4vYb1LUInZQRdc0JJFjYvi_UHRd5YwCYL4fVU4adn6mCcWnqsYaI';
const urlBase64ToUint8Array=(base64String:string)=>{const padding='='.repeat((4-base64String.length%4)%4);const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');const raw=atob(base64);const out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;};
export type PushState='unsupported'|'denied'|'subscribed'|'off'|'default';
export async function pushState():Promise<PushState>{if(typeof navigator==='undefined'||!('serviceWorker' in navigator)||typeof window==='undefined'||!('PushManager' in window)||typeof Notification==='undefined')return 'unsupported';if(Notification.permission==='denied')return 'denied';const reg=await navigator.serviceWorker.getRegistration();const sub=await reg?.pushManager.getSubscription();if(sub)return 'subscribed';if(Notification.permission==='granted')return 'off';return 'default';}
export async function enablePush(){if(await pushState()==='unsupported')throw new Error('pushUnsupported');const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();if(!sub){const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('pushDenied');sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(VAPID_PUBLIC_KEY)});}const user=await identity();const keys=(sub.toJSON() as {keys?:{p256dh:string;auth:string}}).keys;if(!keys)throw new Error('pushUnsupported');const {error}=await client().from('push_subscriptions').upsert({user_id:user.id,endpoint:sub.endpoint,p256dh:keys.p256dh,auth:keys.auth},{onConflict:'endpoint'});if(error)throw error;}
export async function disablePush(){const reg=await navigator.serviceWorker.getRegistration();const sub=await reg?.pushManager.getSubscription();if(!sub)return;const {error}=await client().from('push_subscriptions').delete().eq('endpoint',sub.endpoint);if(error)throw error;await sub.unsubscribe();}
export async function ensureProfile(name?:string){const user=await identity();const existing=await client().from('profiles').select('id,name,display_name,avatar_path,locale,theme').eq('id',user.id).maybeSingle();if(existing.error)throw existing.error;if(existing.data)return existing.data as Profile;const metadataName=typeof user.user_metadata?.name==='string'?user.user_metadata.name.trim():'';const profileName=(name??metadataName).trim();if(!profileName)throw new Error('missingProfileName');return saveProfile({name:profileName});}
export async function markRead(id?:string){const user=await identity();let q=client().from('notifications').update({read_at:new Date().toISOString()}).eq('user_id',user.id).is('read_at',null);if(id)q=q.eq('id',id);const {error}=await q;if(error)throw error;}
const preferenceKeys={notification_preferences:['moods','reactions','care','dates','memories','diary'],privacy_settings:['mood_visibility']};
export async function savePreferences(table:'notification_preferences'|'privacy_settings',values:Record<string,boolean|string>){const user=await identity();const allowed=Object.fromEntries(Object.entries(values).filter(([key])=>preferenceKeys[table].includes(key)));const {error}=await client().from(table).upsert({...allowed,user_id:user.id},{onConflict:'user_id'});if(error)throw error;}
export async function getPreferences(table:'notification_preferences'|'privacy_settings'){const user=await identity();const {data,error}=await client().from(table).select('*').eq('user_id',user.id).maybeSingle();if(error)throw error;return data as Record<string,boolean|string>|null;}
export async function deleteAccount(){await identity();const {error}=await client().rpc('delete_my_account');if(error)throw error;await client(false).auth.signOut();}
