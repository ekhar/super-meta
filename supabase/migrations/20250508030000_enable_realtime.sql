-- Enable realtime for all relevant tables
begin;
  -- Drop existing publication if it exists
  drop publication if exists supabase_realtime;

  -- Create a new publication for all tables
  create publication supabase_realtime for table 
    user_roles,
    databases,
    user_metrics,
    user_metrics_daily;
commit;

-- Create a function to broadcast changes
create or replace function public.handle_realtime_updates()
returns trigger
language plpgsql
as $$
begin
  perform realtime.broadcast_changes(
    'table:' || TG_TABLE_NAME::text,  -- topic
    TG_OP,                            -- event
    TG_OP,                            -- operation
    TG_TABLE_NAME,                    -- table
    TG_TABLE_SCHEMA,                  -- schema
    case 
      when (TG_OP = 'DELETE') then OLD
      else NEW
    end,
    case 
      when (TG_OP = 'INSERT') then null 
      else OLD
    end
  );
  return null;
end;
$$;

-- Create triggers for each table
create trigger on_user_roles_change
  after insert or update or delete on public.user_roles
  for each row execute function public.handle_realtime_updates();

create trigger on_databases_change
  after insert or update or delete on public.databases
  for each row execute function public.handle_realtime_updates();

create trigger on_user_metrics_change
  after insert or update or delete on public.user_metrics
  for each row execute function public.handle_realtime_updates();

create trigger on_user_metrics_daily_change
  after insert or update or delete on public.user_metrics_daily
  for each row execute function public.handle_realtime_updates();

-- Enable realtime authorization for authenticated users
create policy "Allow authenticated users to receive realtime updates"
  on realtime.messages
  for select
  to authenticated
  using (true); 