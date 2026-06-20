/*
# Create trips + trip_status_history tables

1. Purpose
   The Trip Management module lets admins create trips, assign a driver and
   vehicle, advance status through the trip lifecycle, and view a timeline of
   status changes. Drivers come from the `drivers` table, vehicles from
   `vehicles` (both created in earlier modules). Single-tenant from an RLS
   perspective (UI already guarded by the app's JWT auth).

2. New Table: trips
   - id                  uuid, primary key (gen_random_uuid)
   - trip_code           text, unique, not null   — e.g. "TRP-0001"
   - pickup_location     text, not null
   - drop_location       text, not null
   - scheduled_date      date, nullable
   - assigned_driver_id  uuid, FK drivers(id) ON DELETE SET NULL
   - assigned_vehicle_id uuid, FK vehicles(id) ON DELETE SET NULL
   - distance_km         numeric, nullable         — estimated distance in km
   - estimated_minutes   numeric, nullable         — estimated duration in min
   - status              text, not null default 'pending'
                          CHECK in ('pending','assigned','started','in_transit','completed','cancelled')
   - notes               text, nullable
   - created_at          timestamptz, default now()
   - updated_at          timestamptz, default now()

3. New Table: trip_status_history (timeline)
   - id          uuid, primary key
   - trip_id     uuid, not null, FK trips(id) ON DELETE CASCADE
   - status      text, not null  — the status entered
   - from_status text, nullable   — previous status (for transitions)
   - actor       text, nullable   — who made the change
   - note        text, nullable
   - created_at  timestamptz, default now()

4. Indexes
   - trips_trip_code_key (unique)
   - trips_status_idx
   - trips_scheduled_date_idx
   - trips_assigned_driver_id_idx
   - trips_assigned_vehicle_id_idx
   - trip_status_history_trip_id_idx

5. Security (RLS)
   - RLS enabled on both tables.
   - Four CRUD policies each, granted TO anon, authenticated with USING/WITH CHECK (true)
     because the module is intentionally single-tenant and access is gated by app JWT auth.
*/

CREATE TABLE IF NOT EXISTS trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_code text UNIQUE NOT NULL,
  pickup_location text NOT NULL,
  drop_location text NOT NULL,
  scheduled_date date,
  assigned_driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  assigned_vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  distance_km numeric,
  estimated_minutes numeric,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','assigned','started','in_transit','completed','cancelled')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trips_status_idx ON trips (status);
CREATE INDEX IF NOT EXISTS trips_scheduled_date_idx ON trips (scheduled_date);
CREATE INDEX IF NOT EXISTS trips_assigned_driver_id_idx ON trips (assigned_driver_id);
CREATE INDEX IF NOT EXISTS trips_assigned_vehicle_id_idx ON trips (assigned_vehicle_id);

CREATE TABLE IF NOT EXISTS trip_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  status text NOT NULL,
  from_status text,
  actor text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trip_status_history_trip_id_idx ON trip_status_history (trip_id);

ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_trips" ON trips;
CREATE POLICY "anon_select_trips" ON trips FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_trips" ON trips;
CREATE POLICY "anon_insert_trips" ON trips FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_trips" ON trips;
CREATE POLICY "anon_update_trips" ON trips FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_trips" ON trips;
CREATE POLICY "anon_delete_trips" ON trips FOR DELETE
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_trip_status_history" ON trip_status_history;
CREATE POLICY "anon_select_trip_status_history" ON trip_status_history FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_trip_status_history" ON trip_status_history;
CREATE POLICY "anon_insert_trip_status_history" ON trip_status_history FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_trip_status_history" ON trip_status_history;
CREATE POLICY "anon_delete_trip_status_history" ON trip_status_history FOR DELETE
  TO anon, authenticated USING (true);
