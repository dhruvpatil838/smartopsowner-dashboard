/*
# Create pods table + storage bucket for Proof of Delivery

1. Purpose
   The Proof of Delivery (POD) module lets drivers capture/upload photos at
   trip START and trip END, stores them in Supabase Storage, and lets admins
   view, download, and verify each POD. Single-tenant from an RLS perspective
   (the UI is already guarded by the app's JWT auth).

2. New Table: pods
   - id            uuid, primary key (gen_random_uuid)
   - trip_code     text, nullable          — reference to a trip/delivery code
   - driver_id     uuid, nullable          — FK to drivers(id)
   - driver_name   text, not null          — snapshot at upload time
   - start_photo_path  text, nullable       — storage object path for trip-start image
   - start_photo_at   timestamptz, nullable — when start photo was uploaded
   - end_photo_path    text, nullable       — storage object path for trip-end image
   - end_photo_at      timestamptz, nullable — when end photo was uploaded
   - notes        text, nullable
   - status       text, not null default 'pending' — 'pending' | 'verified' | 'rejected'
   - verified_at  timestamptz, nullable
   - verified_by  text, nullable            — admin name who verified
   - created_at   timestamptz, default now()
   - updated_at   timestamptz, default now()

3. Storage
   - Bucket 'pods' (public read so the admin viewer can render thumbnails; writes
     are gated by RLS policies granting anon+authenticated insert/update/delete).
   - Storage object policies allow anon+authenticated full CRUD on the 'pods' bucket,
     because the app's JWT auth already gates the page.

4. Indexes
   - pods_driver_id_idx
   - pods_status_idx

5. Security (RLS)
   - RLS enabled on pods with anon+authenticated CRUD (true).
   - Storage policies on the 'pods' bucket for anon+authenticated CRUD.
*/

CREATE TABLE IF NOT EXISTS pods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_code text,
  driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  driver_name text NOT NULL,
  start_photo_path text,
  start_photo_at timestamptz,
  end_photo_path text,
  end_photo_at timestamptz,
  notes text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'verified', 'rejected')),
  verified_at timestamptz,
  verified_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pods_driver_id_idx ON pods (driver_id);
CREATE INDEX IF NOT EXISTS pods_status_idx ON pods (status);
CREATE INDEX IF NOT EXISTS pods_created_at_idx ON pods (created_at DESC);

ALTER TABLE pods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_pods" ON pods;
CREATE POLICY "anon_select_pods" ON pods FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_pods" ON pods;
CREATE POLICY "anon_insert_pods" ON pods FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_pods" ON pods;
CREATE POLICY "anon_update_pods" ON pods FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_pods" ON pods;
CREATE POLICY "anon_delete_pods" ON pods FOR DELETE
  TO anon, authenticated USING (true);

-- Storage bucket (public so thumbnails render without signed URLs in admin view)
INSERT INTO storage.buckets (id, name, public)
VALUES ('pods', 'pods', true)
ON CONFLICT (id) DO NOTHING;

-- Storage object policies
DROP POLICY IF EXISTS "anon_select_pod_objects" ON storage.objects;
CREATE POLICY "anon_select_pod_objects" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'pods');

DROP POLICY IF EXISTS "anon_insert_pod_objects" ON storage.objects;
CREATE POLICY "anon_insert_pod_objects" ON storage.objects
  FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'pods');

DROP POLICY IF EXISTS "anon_update_pod_objects" ON storage.objects;
CREATE POLICY "anon_update_pod_objects" ON storage.objects
  FOR UPDATE TO anon, authenticated USING (bucket_id = 'pods') WITH CHECK (bucket_id = 'pods');

DROP POLICY IF EXISTS "anon_delete_pod_objects" ON storage.objects;
CREATE POLICY "anon_delete_pod_objects" ON storage.objects
  FOR DELETE TO anon, authenticated USING (bucket_id = 'pods');
