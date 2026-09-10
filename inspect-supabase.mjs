// Read-only inspection. Never applies migrations. Do not run against another project.
import postgres from 'postgres';
const ref='wsyfeitsqrxmvrjrghey';
const value=process.env.DATABASE_URL;
if(!value)throw new Error('BLOCKED: server-side DATABASE_URL is required for read-only schema inspection.');
const url=new URL(value);
const direct=url.hostname===`db.${ref}.supabase.co`;
const pooler=url.hostname.endsWith('.pooler.supabase.com')&&decodeURIComponent(url.username)===`postgres.${ref}`;
if(!direct&&!pooler)throw new Error('BLOCKED: DATABASE_URL does not identify the FEELINGS Supabase project. No connection attempted.');
const sql=postgres(value,{ssl:'require',max:1,connect_timeout:15,prepare:false});
try{
 const report=await sql.begin('read only',async tx=>({
 project:ref,
 tables:await tx`select schemaname, tablename, rowsecurity from pg_tables where schemaname in ('public','storage','realtime') order by schemaname,tablename`,
 columns:await tx`select table_schema,table_name,column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' order by table_name,ordinal_position`,
 constraints:await tx`select n.nspname as schema,t.relname as table_name,c.conname,pg_get_constraintdef(c.oid) as definition from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname='public'`,
 indexes:await tx`select schemaname,tablename,indexname,indexdef from pg_indexes where schemaname='public'`,
 functions:await tx`select n.nspname as schema,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,p.prosecdef as security_definer,p.proconfig,pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f'`,
 policies:await tx`select * from pg_policies where schemaname in ('public','storage','realtime')`,
 grants:await tx`select table_schema,table_name,grantee,privilege_type from information_schema.role_table_grants where table_schema in ('public','storage','realtime') and grantee in ('anon','authenticated','public')`,
 publications:await tx`select pubname,schemaname,tablename from pg_publication_tables where pubname='supabase_realtime'`,
 replica_identity:await tx`select n.nspname,c.relname,c.relreplident from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'`,
 buckets:await tx`select id,name,public,file_size_limit,allowed_mime_types from storage.buckets`,
 triggers:await tx`select event_object_table,trigger_name,event_manipulation,action_statement from information_schema.triggers where trigger_schema='public'`
 }));
 console.log(JSON.stringify(report,null,2));
}finally{await sql.end();}
