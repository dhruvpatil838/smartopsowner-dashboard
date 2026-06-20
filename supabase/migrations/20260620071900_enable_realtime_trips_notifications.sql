/*
# Enable Realtime + create trip_notifications table

1. Purpose
   Enables Supabase Realtime broadcast on the `trips` and `trip_notifications`
   tables so the Trip Management module can update both portals instantly:
   - When an admin assigns a trip (SET assigned_driver_id), the driver portal
     receives a new `trip_notifications` row in real time (toast + badge) and the
     trips list updates live.
   - When a driver updates trip status, the admin Trips page gets an UPDATE
     event on `trips` and refreshes its row without a page reload.

2. Realtime
   - `alter publication supabase_realtime add table trips, trip_notifications;`
     (idempotent via DO block).
   Realtime only emits events for rows the listening anon/authenticated client
   can see — both tables have open RLS policies (true), so events flow.

3. New Table: trip_notifications
   - id            uuid, primary key
   - driver_email  text, indexed          — driver's email (used as audience key
                                              since the driver portal session is
                                              keyed by the auth user's email)
   - driver_id      uuid, nullable         — FK drivers(id) ON DELETE SET NULL
   - trip_id        uuid, nullable         — FK trips(id) ON DELETE CASCADE
   - trip_code      text, nullable         — snapshot for display
   - type           text, not null         — 'trip_assigned' | 'trip_unassigned' | 'status_changed'
   - title          text, not null
   - body           text, nullable
   - read           boolean, default false
   - created_at     timestamptz, default now()

4. Indexes
   - trip_notifications_driver_email_idx
   - trip_notifications_driver_id_idx
   - trip_notifications_created_at_idx

5. Security (RLS)
   - RLS enabled on trip_notifications.
   - anon+authenticated CRUD (true). Single-tenant, gated by app JWT auth.
*/

CREATE TABLE IF NOT EXISTS trip_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_email text,
  driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
  trip_code text,
  type text NOT NULL CHECK (type IN ('trip_assigned','trip_unassigned','status_changed')),
  title text NOT NULL,
  body text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trip_notifications_driver_email_idx ON trip_notifications (driver_email);
CREATE INDEX IF NOT EXISTS trip_notifications_driver_id_idx ON trip_notifications (driver_id);
CREATE INDEX IF NOT EXISTS trip_notifications_created_at_idx ON trip_notifications (created_at DESC);

ALTER TABLE trip_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_trip_notifications" ON trip_notifications;
CREATE POLICY "anon_select_trip_notifications" ON trip_notifications FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_trip_notifications" ON trip_notifications;
CREATE POLICY "anon_insert_trip_notifications" ON trip_notifications FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_trip_notifications" ON trip_notifications;
CREATE POLICY "anon_update_trip_notifications" ON trip_notifications FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_trip_notifications" ON trip_notifications;
CREATE POLICY "anon_delete_trip_notifications" ON trip_notifications FOR DELETE
  TO anon, authenticated USING (true);

-- Add tables to the Realtime publication (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'trips'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE trips;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'trip_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE trip_notifications;
  END IF;
END $$;
