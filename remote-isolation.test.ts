import {describe,it,expect} from 'vitest';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
const url='https://wsyfeitsqrxmvrjrghey.supabase.co';
const key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY??process.env.VITE_SUPABASE_ANON_KEY;
const enabled=process.env.RUN_REMOTE_ISOLATION==='true'&&Boolean(key);
const accounts=['A1','A2','B1','B2'];
const tables=['moods','mood_reactions','care_signals','memories','important_dates','calendar_events','diary_entries','cycle_logs','notifications'];
describe.skipIf(!enabled)('REAL RLS isolation across four accounts (pre-seeded dedicated test couples)',()=>{
 it('denies cross-couple reads using known foreign IDs and protects private cycle data',async()=>{
  const clients:SupabaseClient[]=[];const users:string[]=[];const couples:string[]=[];
  try{
   for(const name of accounts){const email=process.env[`TEST_${name}_EMAIL`],password=process.env[`TEST_${name}_PASSWORD`];expect(email,`BLOCKED: TEST_${name}_EMAIL missing`).toBeTruthy();expect(password,`BLOCKED: TEST_${name}_PASSWORD missing`).toBeTruthy();const client=createClient(url,key!,{auth:{persistSession:false,autoRefreshToken:false}});const {data,error}=await client.auth.signInWithPassword({email:email!,password:password!});expect(error).toBeNull();clients.push(client);users.push(data.user!.id);const context=await client.rpc('get_my_couple');expect(context.error).toBeNull();expect(context.data?.id,'Dedicated accounts must already belong to test couples').toBeTruthy();couples.push(context.data.id);}
   expect(couples[0]).toBe(couples[1]);expect(couples[2]).toBe(couples[3]);expect(couples[0]).not.toBe(couples[2]);
   for(const table of tables){const foreign=await clients[2].from(table).select('*').limit(1);expect(foreign.error).toBeNull();expect(foreign.data?.length,`BLOCKED: seed a real ${table} row for B1 first`).toBe(1);for(const index of [0,1]){const attempt=await clients[index].from(table).select('*').eq('id',foreign.data![0].id);expect(attempt.error).toBeNull();expect(attempt.data).toEqual([]);}}
   const privateCycles=await clients[0].from('cycle_logs').select('id').eq('user_id',users[0]).eq('visibility','private').limit(1);expect(privateCycles.error).toBeNull();expect(privateCycles.data?.length,'BLOCKED: seed a private cycle for A1').toBe(1);const partnerRead=await clients[1].from('cycle_logs').select('*').eq('id',privateCycles.data![0].id);expect(partnerRead.error).toBeNull();expect(partnerRead.data).toEqual([]);
  }finally{for(const client of clients)await client.auth.signOut();}
 },60000);
});
