create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.users (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

insert into public.users (id)
select id from auth.users
on conflict (id) do nothing;

create policy "users_select_own" on public.users
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "users_update_own" on public.users
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "saved_opportunities_select_own" on public.saved_opportunities
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "saved_opportunities_insert_own" on public.saved_opportunities
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "saved_opportunities_update_own" on public.saved_opportunities
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "saved_opportunities_delete_own" on public.saved_opportunities
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "application_statuses_select_own" on public.application_statuses
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "application_statuses_insert_own" on public.application_statuses
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "application_statuses_update_own" on public.application_statuses
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "application_statuses_delete_own" on public.application_statuses
  for delete to authenticated
  using ((select auth.uid()) = user_id);
