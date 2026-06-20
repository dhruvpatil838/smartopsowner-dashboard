/*
# Create revenue and earnings tables

1. Purpose
   Track revenue from trips and driver earnings. Revenue is tracked per trip,
   with driver earnings calculated as a percentage of the trip fare.

2. Changes to trips table
   - Add fare_amount (numeric) - the revenue collected for the trip
   - Add driver_earnings (numeric) - calculated earnings for the driver
   - Add payment_status (text) - pending/paid/refunded
   - Add completed_at (timestamptz) - when trip was actually completed

3. New Table: driver_earnings
   - Tracks individual earning records for drivers
   - Links to trips and drivers
   - Includes status and payment dates

4. New Table: revenue_transactions
   - Audit trail for all revenue movements
   - Links to trips, drivers, vehicles
*/

-- Add revenue fields to trips table
ALTER TABLE trips 
  ADD COLUMN IF NOT EXISTS fare_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS driver_earnings numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending'
    CHECK (payment_status IN ('pending','paid','refunded','cancelled')),
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS base_fare numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS distance_charge numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS waiting_charge numeric DEFAULT 0;

-- Create driver_earnings table for detailed tracking
CREATE TABLE IF NOT EXISTS driver_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES trips(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  earnings_type text NOT NULL DEFAULT 'trip_earnings'
    CHECK (earnings_type IN ('trip_earnings','bonus','adjustment','penalty','tip')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','cancelled')),
  description text,
  earned_date date NOT NULL DEFAULT CURRENT_DATE,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create revenue_transactions for audit trail
CREATE TABLE IF NOT EXISTS revenue_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type text NOT NULL
    CHECK (transaction_type IN ('trip_revenue','refund','adjustment','bonus')),
  trip_id uuid REFERENCES trips(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  description text,
  transaction_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS driver_earnings_driver_id_idx ON driver_earnings (driver_id);
CREATE INDEX IF NOT EXISTS driver_earnings_trip_id_idx ON driver_earnings (trip_id);
CREATE INDEX IF NOT EXISTS driver_earnings_earned_date_idx ON driver_earnings (earned_date);
CREATE INDEX IF NOT EXISTS driver_earnings_status_idx ON driver_earnings (status);

CREATE INDEX IF NOT EXISTS revenue_transactions_date_idx ON revenue_transactions (transaction_date);
CREATE INDEX IF NOT EXISTS revenue_transactions_driver_id_idx ON revenue_transactions (driver_id);
CREATE INDEX IF NOT EXISTS revenue_transactions_vehicle_id_idx ON revenue_transactions (vehicle_id);
CREATE INDEX IF NOT EXISTS revenue_transactions_trip_id_idx ON revenue_transactions (trip_id);

ALTER TABLE driver_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for driver_earnings
DROP POLICY IF EXISTS "anon_select_driver_earnings" ON driver_earnings;
CREATE POLICY "anon_select_driver_earnings" ON driver_earnings FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_driver_earnings" ON driver_earnings;
CREATE POLICY "anon_insert_driver_earnings" ON driver_earnings FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_driver_earnings" ON driver_earnings;
CREATE POLICY "anon_update_driver_earnings" ON driver_earnings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_driver_earnings" ON driver_earnings;
CREATE POLICY "anon_delete_driver_earnings" ON driver_earnings FOR DELETE
  TO anon, authenticated USING (true);

-- RLS policies for revenue_transactions
DROP POLICY IF EXISTS "anon_select_revenue_transactions" ON revenue_transactions;
CREATE POLICY "anon_select_revenue_transactions" ON revenue_transactions FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_revenue_transactions" ON revenue_transactions;
CREATE POLICY "anon_insert_revenue_transactions" ON revenue_transactions FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_revenue_transactions" ON revenue_transactions;
CREATE POLICY "anon_delete_revenue_transactions" ON revenue_transactions FOR DELETE
  TO anon, authenticated USING (true);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_driver_earnings_updated_at ON driver_earnings;
CREATE TRIGGER update_driver_earnings_updated_at
  BEFORE UPDATE ON driver_earnings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();