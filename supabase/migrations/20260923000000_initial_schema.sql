-- Private friends-only social app: authenticated users can read shared content.
-- Store Storage object paths (not public URLs) in avatar_path, cover_path and image_path.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  display_name text not null default 'Nuevo usuario',
  bio text not null default '',
  avatar_path text,
  cover_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (
    username = lower(username) and username ~ '^[a-z0-9_]{3,40}$'
  )
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_body_or_image check (char_length(btrim(body)) > 0 or image_path is not null)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  parent_comment_id uuid,
  body text not null,
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint comments_id_post_unique unique (id, post_id),
  constraint comments_body_or_image check (char_length(btrim(body)) > 0 or image_path is not null),
  constraint comments_parent_same_post_fk
    foreign key (parent_comment_id, post_id)
    references public.comments (id, post_id)
    on delete cascade
);

create table public.likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.reposts (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index posts_created_at_idx on public.posts (created_at desc);
create index posts_user_created_at_idx on public.posts (user_id, created_at desc);
create index comments_post_created_at_idx on public.comments (post_id, created_at asc);
create index comments_parent_created_at_idx on public.comments (parent_comment_id, created_at asc);
create index comments_user_created_at_idx on public.comments (user_id, created_at desc);
create index likes_user_created_at_idx on public.likes (user_id, created_at desc);
create index reposts_user_created_at_idx on public.reposts (user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger posts_set_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

create trigger comments_set_updated_at
before update on public.comments
for each row execute function public.set_updated_at();

-- Create a profile in the same transaction as each Auth user. Fall back to a
-- UUID-derived username if supplied metadata is missing, invalid or taken.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text;
  fallback_username text;
  requested_display_name text;
begin
  requested_username := lower(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  fallback_username := 'user_' || replace(new.id::text, '-', '');
  requested_display_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    'Nuevo usuario'
  );

  if requested_username !~ '^[a-z0-9_]{3,32}$' then
    requested_username := fallback_username;
  end if;

  begin
    insert into public.profiles (id, username, display_name)
    values (new.id, requested_username, requested_display_name)
    on conflict (id) do nothing;
  exception when unique_violation then
    insert into public.profiles (id, username, display_name)
    values (new.id, fallback_username, requested_display_name)
    on conflict (id) do nothing;
  end;

  return new;
end;
$$;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.reposts enable row level security;

grant usage on schema public to authenticated;
grant select on public.profiles to authenticated;
grant update (username, display_name, bio, avatar_path, cover_path) on public.profiles to authenticated;
grant select, delete on public.posts to authenticated;
grant insert (user_id, body, image_path) on public.posts to authenticated;
grant update (body, image_path) on public.posts to authenticated;
grant select, delete on public.comments to authenticated;
grant insert (post_id, user_id, parent_comment_id, body, image_path) on public.comments to authenticated;
grant update (body, image_path) on public.comments to authenticated;
grant select, delete on public.likes to authenticated;
grant insert (post_id, user_id) on public.likes to authenticated;
grant select, delete on public.reposts to authenticated;
grant insert (post_id, user_id) on public.reposts to authenticated;

create policy "Authenticated users can read profiles"
on public.profiles for select to authenticated
using ((select auth.uid()) is not null);

create policy "Users can update their own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Authenticated users can read posts"
on public.posts for select to authenticated
using ((select auth.uid()) is not null);

create policy "Users can create their own posts"
on public.posts for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own posts"
on public.posts for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own posts"
on public.posts for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "Authenticated users can read comments"
on public.comments for select to authenticated
using ((select auth.uid()) is not null);

create policy "Users can create their own comments"
on public.comments for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own comments"
on public.comments for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own comments"
on public.comments for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "Authenticated users can read likes"
on public.likes for select to authenticated
using ((select auth.uid()) is not null);

create policy "Users can create their own likes"
on public.likes for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own likes"
on public.likes for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "Authenticated users can read reposts"
on public.reposts for select to authenticated
using ((select auth.uid()) is not null);

create policy "Users can create their own reposts"
on public.reposts for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own reposts"
on public.reposts for delete to authenticated
using ((select auth.uid()) = user_id);

-- Private buckets. Keep each user's objects under {auth.uid()}/{filename}.
insert into storage.buckets (id, name, public, allowed_mime_types)
values
  ('avatars', 'avatars', false, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),
  ('covers', 'covers', false, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),
  ('post-images', 'post-images', false, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),
  ('comment-images', 'comment-images', false, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update
set public = false,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Authenticated users can read social images"
on storage.objects for select to authenticated
using (bucket_id in ('avatars', 'covers', 'post-images', 'comment-images'));

create policy "Users can upload images to their own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id in ('avatars', 'covers', 'post-images', 'comment-images')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can update images in their own folder"
on storage.objects for update to authenticated
using (
  bucket_id in ('avatars', 'covers', 'post-images', 'comment-images')
  and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id in ('avatars', 'covers', 'post-images', 'comment-images')
  and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can delete images in their own folder"
on storage.objects for delete to authenticated
using (
  bucket_id in ('avatars', 'covers', 'post-images', 'comment-images')
  and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
