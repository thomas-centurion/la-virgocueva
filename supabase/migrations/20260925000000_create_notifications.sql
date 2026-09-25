create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('follow', 'like', 'repost', 'comment', 'reply')),
  post_id uuid references public.posts (id) on delete set null,
  comment_id uuid references public.comments (id) on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint notifications_no_self_notification check (actor_id <> recipient_id)
);

create index notifications_recipient_id_idx
  on public.notifications (recipient_id);
create index notifications_recipient_read_at_idx
  on public.notifications (recipient_id, read_at);
create index notifications_recipient_created_at_idx
  on public.notifications (recipient_id, created_at desc);
create index notifications_created_at_idx
  on public.notifications (created_at desc);
create index notifications_unread_recipient_created_at_idx
  on public.notifications (recipient_id, created_at desc)
  where read_at is null;

alter table public.notifications enable row level security;

revoke all on public.notifications from public, anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy "Users can read their own notifications"
on public.notifications for select to authenticated
using ((select auth.uid()) = recipient_id);

create policy "Users can mark their own notifications as read"
on public.notifications for update to authenticated
using ((select auth.uid()) = recipient_id)
with check ((select auth.uid()) = recipient_id and read_at is not null);

-- Only trusted database triggers create notification rows. The client has no
-- INSERT privilege, and the trigger function runs with its owner's privileges.
create or replace function public.create_social_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  notification_recipient uuid;
  notification_actor uuid;
  notification_type text;
  notification_post uuid;
  notification_comment uuid;
begin
  if tg_table_name = 'follows' then
    notification_recipient := new.following_id;
    notification_actor := new.follower_id;
    notification_type := 'follow';
  elsif tg_table_name = 'likes' then
    select p.user_id into notification_recipient
    from public.posts as p
    where p.id = new.post_id;
    notification_actor := new.user_id;
    notification_type := 'like';
    notification_post := new.post_id;
  elsif tg_table_name = 'reposts' then
    select p.user_id into notification_recipient
    from public.posts as p
    where p.id = new.post_id;
    notification_actor := new.user_id;
    notification_type := 'repost';
    notification_post := new.post_id;
  elsif tg_table_name = 'comments' then
    notification_actor := new.user_id;
    notification_post := new.post_id;
    notification_comment := new.id;

    if new.parent_comment_id is null then
      select p.user_id into notification_recipient
      from public.posts as p
      where p.id = new.post_id;
      notification_type := 'comment';
    else
      -- Replies notify the parent comment's author only. This avoids a second
      -- notification to the post author when both authors are the same person.
      select c.user_id into notification_recipient
      from public.comments as c
      where c.id = new.parent_comment_id
        and c.post_id = new.post_id;
      notification_type := 'reply';
    end if;
  else
    raise exception 'Unsupported notification source table: %', tg_table_name;
  end if;

  if notification_recipient is null
    or notification_actor is null
    or notification_recipient = notification_actor then
    return new;
  end if;

  insert into public.notifications (
    recipient_id,
    actor_id,
    type,
    post_id,
    comment_id
  ) values (
    notification_recipient,
    notification_actor,
    notification_type,
    notification_post,
    notification_comment
  );

  return new;
end;
$$;

revoke all on function public.create_social_notification() from public, anon, authenticated;

create trigger follows_create_notification
after insert on public.follows
for each row execute function public.create_social_notification();

create trigger likes_create_notification
after insert on public.likes
for each row execute function public.create_social_notification();

create trigger reposts_create_notification
after insert on public.reposts
for each row execute function public.create_social_notification();

create trigger comments_create_notification
after insert on public.comments
for each row execute function public.create_social_notification();
