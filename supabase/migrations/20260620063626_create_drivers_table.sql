/*
# Create drivers table

1. Purpose
   Persistent store for the Driver Management module. Replaces the MongoDB-backed
   `driver-management` collection for this module. The app uses a separate JWT
   auth system already guarding the UI route; this table is single-tenant from
   RLS perspective, allowing the anon+authenticated Supabase keys the frontend
   uses to perform full CRUD.

2. New Table: drivers
   - id              uuid, primary key (gen_random_uuid)
   - driver_code     text, unique, not null  — human-friendly ID like "DRV-001"
   - full_name       text, not null
   - email           text, nullable
   - phone           text, nullable
   - address         text, nullable
   - license_number  text, nullable
   - license_expiry  date, nullable
   - vehicle_assigned text, nullable
   - joining_date    date, nullable
   - status          text, not null, default 'active'  — 'active' | 'inactive' | 'on_leave'
   - profile_photo   text, nullable  — public URL (Supabase Storage)
   - created_at      timestamptz, default now()
   - updated_at      timestamptz, default now()

3. Indexes
   - drivers_driver_code_key (unique)
   - drivers_status_idx
   - drivers_full_name_idx

4. Security (RLS)
   - RLS enabled on drivers.
   - Four CRUD policies granted TO anon, authenticated with USING/WITH CHECK (true),
     because the module is intentionally shared (single-tenant) and access control to
     the page is enforced by the app's existing JWT auth layer.
*/

CREATE TABLE IF NOT EXISTS drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_code text UNIQUE NOT NULL,
  full_name text NOT NULL,
  email text,
  phone text,
  address text,
  license_number text,
  license_expiry date,
  vehicle_assigned text,
  joining_date date,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'on_leave')),
  profile_photo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS drivers_status_idx ON drivers (status);
CREATE INDEX IF NOT EXISTS drivers_full_name_idx ON drivers (full_name);

ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_drivers" ON drivers;
CREATE POLICY "anon_select_drivers" ON drivers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_drivers" ON drivers;
CREATE POLICY "anon_insert_drivers" ON drivers FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_drivers" ON drivers;
CREATE POLICY "anon_update_drivers" ON drivers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_drivers" ON drivers;
CREATE POLICY "anon_delete_drivers" ON drivers FOR DELETE
  TO anon, authenticated USING (true);
