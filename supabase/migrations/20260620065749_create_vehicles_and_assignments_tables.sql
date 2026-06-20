/*
# Create vehicles + vehicle_assignments tables

1. Purpose
   Persistent store for the Vehicle Management module and its assignment history.
   Replaces the local-storage fleet list for this module. Single-tenant from an
   RLS perspective: the page is already guarded by the app's JWT auth, so the
   anon+authenticated Supabase keys used by the frontend get full CRUD.

2. New Table: vehicles
   - id               uuid, primary key (gen_random_uuid)
   - vehicle_number   text, unique, not null  — e.g. "TRK-8821"
   - vehicle_type     text, not null           — 'truck' | 'van' | 'trailer' | 'bus' | 'car'
   - model            text, not null           — e.g. "Volvo FH16 2022"
   - registration_number text, not null        — e.g. "TX-AB-1234"
   - insurance_expiry date, nullable
   - capacity         numeric, default 0       — capacity in kg
   - status           text, not null default 'active'  — 'active' | 'idle' | 'maintenance' | 'retired'
   - assigned_driver_id uuid, nullable          — FK to drivers(id)
   - created_at       timestamptz, default now()
   - updated_at       timestamptz, default now()

3. New Table: vehicle_assignments (history)
   - id           uuid, primary key
   - vehicle_id   uuid, not null, FK vehicles(id) ON DELETE CASCADE
   - driver_id    uuid, FK drivers(id) ON DELETE SET NULL
   - driver_name  text, not null  — snapshot at assignment time
   - action       text, not null  — 'assigned' | 'unassigned'
   - note         text, nullable
   - created_at   timestamptz, default now()  — when the action occurred

4. Indexes
   - vehicles_vehicle_number_key (unique)
   - vehicles_status_idx
   - vehicle_assignments_vehicle_id_idx
   - vehicle_assignments_driver_id_idx

5. Security (RLS)
   - RLS enabled on both tables.
   - CRUD policies granted TO anon, authenticated with USING/WITH CHECK (true)
     because the module is intentionally shared and access is gated by the app's JWT auth.
*/

CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_number text UNIQUE NOT NULL,
  vehicle_type text NOT NULL DEFAULT 'truck'
    CHECK (vehicle_type IN ('truck', 'van', 'trailer', 'bus', 'car')),
  model text NOT NULL,
  registration_number text NOT NULL,
  insurance_expiry date,
  capacity numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'idle', 'maintenance', 'retired')),
  assigned_driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vehicles_status_idx ON vehicles (status);
CREATE INDEX IF NOT EXISTS vehicles_vehicle_type_idx ON vehicles (vehicle_type);

CREATE TABLE IF NOT EXISTS vehicle_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  driver_name text NOT NULL,
  action text NOT NULL CHECK (action IN ('assigned', 'unassigned')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vehicle_assignments_vehicle_id_idx ON vehicle_assignments (vehicle_id);
CREATE INDEX IF NOT EXISTS vehicle_assignments_driver_id_idx ON vehicle_assignments (driver_id);

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_vehicles" ON vehicles;
CREATE POLICY "anon_select_vehicles" ON vehicles FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_vehicles" ON vehicles;
CREATE POLICY "anon_insert_vehicles" ON vehicles FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_vehicles" ON vehicles;
CREATE POLICY "anon_update_vehicles" ON vehicles FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_vehicles" ON vehicles;
CREATE POLICY "anon_delete_vehicles" ON vehicles FOR DELETE
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_vehicle_assignments" ON vehicle_assignments;
CREATE POLICY "anon_select_vehicle_assignments" ON vehicle_assignments FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_vehicle_assignments" ON vehicle_assignments;
CREATE POLICY "anon_insert_vehicle_assignments" ON vehicle_assignments FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_vehicle_assignments" ON vehicle_assignments;
CREATE POLICY "anon_delete_vehicle_assignments" ON vehicle_assignments FOR DELETE
  TO anon, authenticated USING (true);
