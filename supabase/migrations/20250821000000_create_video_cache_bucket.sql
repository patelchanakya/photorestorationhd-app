-- Create storage bucket for cached videos
insert into storage.buckets (id, name, public)
values ('video-cache', 'video-cache', true);

-- Set up RLS policies for video cache bucket
create policy "Users can view cached videos"
on storage.objects
for select
to authenticated, anon
using (bucket_id = 'video-cache');

-- Allow the service role to manage cached videos
create policy "Service role can manage cached videos"
on storage.objects
for all
to service_role
using (bucket_id = 'video-cache');

-- video-cache bucket stores downloaded videos from Replicate to prevent URL expiration issues