-- Read-only. Run in CloudBase PostgreSQL SQL editor as the environment owner.
-- Returns schema metadata only, never account/contact data or credentials.
select version();
select n.nspname as schema, p.proname as function,
 pg_get_function_result(p.oid) as result_type
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='auth' and p.proname in ('uid','jwt');
select column_name,data_type from information_schema.columns
where table_schema='auth' and table_name='users' order by ordinal_position;
select rolname from pg_roles where rolname in ('anon','authenticated');
select to_regclass('public.participant_profiles') as existing_study_profiles;
