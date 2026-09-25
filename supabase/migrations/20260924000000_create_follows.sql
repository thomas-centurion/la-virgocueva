create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self_follow check (follower_id <> following_id)
);

create index follows_following_created_at_idx
  on public.follows (following_id, created_at desc);
create index follows_follower_created_at_idx
  on public.follows (follower_id, created_at desc);

create trigger follows_set_updated_at
before update on public.follows
for each row execute function public.set_updated_at();

alter table public.follows enable row level security;

grant select, delete on public.follows to authenticated;
grant insert (follower_id, following_id) on public.follows to authenticated;

create policy "Authenticated users can read follows"
on public.follows for select to authenticated
using ((select auth.uid()) is not null);

create policy "Users can follow others as themselves"
on public.follows for insert to authenticated
with check (
  (select auth.uid()) = follower_id
  and follower_id <> following_id
);

create policy "Users can unfollow others as themselves"
on public.follows for delete to authenticated
using ((select auth.uid()) = follower_id);
