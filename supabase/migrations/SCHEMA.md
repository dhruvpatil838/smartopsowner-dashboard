# SmartOps Database Schema

Complete Supabase database schema for the SmartOps fleet and logistics management system.

## Overview

This document describes the complete database schema including all tables, relationships, indexes, RLS policies, and Realtime support.

## Entity Relationship Diagram

```
users ─────────────────────────────────────────────────────────────┐
  │                                                                 │
  └── driver_id ──> drivers <──────────────────────────────────────┤
                      │                                            │
                      ├──< driver_earnings                         │
                      ├──< vehicle_assignments                     │
                      ├──< trip_notifications                      │
                      ├──< notifications                          │
                      │                                            │
                      └──< trips ──> trip_status_history           │
                          │   │                                    │
                          │   ├──< pods                           │
                          │   ├──< driver_earnings                │
                          │   └──< revenue_transactions            │
                          │                                        │
                          └──> vehicles <──────────────────────────┘
                                │
                                └──< vehicle_assignments
```

## Tables

### Core Tables

#### `users`
Application users with role-based access control (separate from Supabase auth).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() | Primary key |
| email | text | UNIQUE, NOT NULL | User email |
| full_name | text | NOT NULL | Full name |
| role | text | NOT NULL, CHECK | 'admin', 'manager', 'driver', 'dispatcher' |
| driver_id | uuid | FK → drivers.id | Linked driver profile |
| phone | text | | Phone number |
| avatar_url | text | | Profile photo URL |
| is_active | boolean | NOT NULL, DEFAULT true | Account status |
| last_login_at | timestamptz | | Last login timestamp |
| preferences | jsonb | DEFAULT '{}' | User preferences |
| created_at | timestamptz | NOT NULL, DEFAULT now() | Creation timestamp |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | Update timestamp |

**Indexes**: `users_email_idx`, `users_role_idx`, `users_driver_id_idx`

---

#### `drivers`
Driver profiles with license and vehicle assignment info.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | Primary key |
| driver_code | text | UNIQUE, NOT NULL | Human-friendly ID (DRV-XXXX) |
| full_name | text | NOT NULL | Full name |
| email | text | | Email address |
| phone | text | | Phone number |
| address | text | | Physical address |
| license_number | text | | License number |
| license_expiry | date | | License expiration |
| vehicle_assigned | text | | Currently assigned vehicle |
| joining_date | date | | Employment start date |
| status | text | NOT NULL, CHECK | 'active', 'inactive', 'on_leave' |
| profile_photo | text | | Storage URL |
| created_at | timestamptz | NOT NULL, DEFAULT now() | Creation timestamp |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | Update timestamp |

**Indexes**: `drivers_driver_code_key`, `drivers_status_idx`, `drivers_full_name_idx`

---

#### `vehicles`
Fleet vehicle inventory.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | Primary key |
| vehicle_number | text | UNIQUE, NOT NULL | Vehicle ID (VHC-XXXX) |
| vehicle_type | text | NOT NULL, CHECK | 'truck', 'van', 'trailer', 'bus', 'car' |
| model | text | NOT NULL | Vehicle model |
| registration_number | text | NOT NULL | Registration plate |
| insurance_expiry | date | | Insurance expiration |
| capacity | numeric | NOT NULL, DEFAULT 0 | Capacity in kg |
| status | text | NOT NULL, CHECK | 'active', 'idle', 'maintenance', 'retired' |
| assigned_driver_id | uuid | FK → drivers.id | Current driver |
| created_at | timestamptz | NOT NULL, DEFAULT now() | Creation timestamp |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | Update timestamp |

**Indexes**: `vehicles_vehicle_number_key`, `vehicles_status_idx`, `vehicles_vehicle_type_idx`

---

#### `trips`
Trip/delivery records with revenue tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | Primary key |
| trip_code | text | UNIQUE, NOT NULL | Trip ID (TRP-XXXX) |
| pickup_location | text | NOT NULL | Pickup address |
| drop_location | text | NOT NULL | Delivery address |
| scheduled_date | date | | Scheduled date |
| assigned_driver_id | uuid | FK → drivers.id | Assigned driver |
| assigned_vehicle_id | uuid | FK → vehicles.id | Assigned vehicle |
| distance_km | numeric | | Trip distance |
| estimated_minutes | numeric | | Estimated duration |
| status | text | NOT NULL, CHECK | 'pending', 'assigned', 'started', 'in_transit', 'completed', 'cancelled' |
| notes | text | | Trip notes |
| fare_amount | numeric | DEFAULT 0 | Total fare |
| driver_earnings | numeric | DEFAULT 0 | Driver's share |
| base_fare | numeric | DEFAULT 0 | Base fare amount |
| distance_charge | numeric | DEFAULT 0 | Distance-based charge |
| waiting_charge | numeric | DEFAULT 0 | Waiting time charge |
| payment_status | text | CHECK | 'pending', 'paid', 'refunded', 'cancelled' |
| completed_at | timestamptz | | Actual completion time |
| created_at | timestamptz | NOT NULL, DEFAULT now() | Creation timestamp |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | Update timestamp |

**Indexes**: 
- `trips_trip_code_key`
- `trips_status_idx`
- `trips_scheduled_date_idx`
- `trips_assigned_driver_id_idx`
- `trips_assigned_vehicle_id_idx`
- `trips_payment_status_idx`
- `trips_driver_status_idx`
- `trips_vehicle_status_idx`
- `trips_date_status_idx`
- `trips_created_desc_idx`

---

### History & Audit Tables

#### `trip_status_history`
Audit trail of trip status changes.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | Primary key |
| trip_id | uuid | FK → trips.id CASCADE | Trip reference |
| status | text | NOT NULL | New status |
| from_status | text | | Previous status |
| actor | text | | Who made the change |
| note | text | | Change note |
| created_at | timestamptz | NOT NULL, DEFAULT now() | Change timestamp |

**Indexes**: `trip_status_history_trip_id_idx`

---

#### `vehicle_assignments`
Vehicle-driver assignment history.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | Primary key |
| vehicle_id | uuid | FK → vehicles.id CASCADE | Vehicle reference |
| driver_id | uuid | FK → drivers.id | Driver reference |
| driver_name | text | NOT NULL | Driver name snapshot |
| action | text | NOT NULL, CHECK | 'assigned', 'unassigned' |
| note | text | | Assignment note |
| created_at | timestamptz | NOT NULL, DEFAULT now() | Action timestamp |

**Indexes**: `vehicle_assignments_vehicle_id_idx`, `vehicle_assignments_driver_id_idx`

---

### Revenue & Earnings Tables

#### `driver_earnings`
Driver earnings records (trip earnings, bonuses, adjustments).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | Primary key |
| driver_id | uuid | FK → drivers.id CASCADE | Driver reference |
| trip_id | uuid | FK → trips.id | Trip reference |
| amount | numeric | NOT NULL, DEFAULT 0 | Earnings amount |
| earnings_type | text | NOT NULL, CHECK | 'trip_earnings', 'bonus', 'adjustment', 'penalty', 'tip' |
| status | text | NOT NULL, CHECK | 'pending', 'paid', 'cancelled' |
| description | text | | Description |
| earned_date | date | NOT NULL, DEFAULT CURRENT_DATE | Date earned |
| paid_at | timestamptz | | Payment timestamp |
| payout_id | text | | Payout reference |
| payout_method | text | CHECK | 'bank_transfer', 'cash', 'wallet', 'check' |
| payout_reference | text | | Payment reference |
| approved_by | text | | Approver name |
| approved_at | timestamptz | | Approval timestamp |
| created_at | timestamptz | NOT NULL, DEFAULT now() | Creation timestamp |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | Update timestamp |

**Indexes**: 
- `driver_earnings_driver_id_idx`
- `driver_earnings_trip_id_idx`
- `driver_earnings_earned_date_idx`
- `driver_earnings_status_idx`
- `driver_earnings_driver_status_date_idx`

---

#### `revenue_transactions`
Revenue audit trail for all transactions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | Primary key |
| transaction_type | text | NOT NULL, CHECK | 'trip_revenue', 'refund', 'adjustment', 'bonus' |
| trip_id | uuid | FK → trips.id | Trip reference |
| driver_id | uuid | FK → drivers.id | Driver reference |
| vehicle_id | uuid | FK → vehicles.id | Vehicle reference |
| amount | numeric | NOT NULL | Transaction amount |
| description | text | | Description |
| transaction_date | timestamptz | NOT NULL, DEFAULT now() | Transaction date |
| created_at | timestamptz | NOT NULL, DEFAULT now() | Creation timestamp |

**Indexes**: 
- `revenue_transactions_date_idx`
- `revenue_transactions_driver_id_idx`
- `revenue_transactions_vehicle_id_idx`
- `revenue_transactions_trip_id_idx`

---

### POD (Proof of Delivery) Tables

#### `pods`
Proof of delivery photo records.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | Primary key |
| trip_code | text | | Trip code reference |
| driver_id | uuid | FK → drivers.id | Driver reference |
| driver_name | text | NOT NULL | Driver name snapshot |
| start_photo_path | text | | Start photo storage path |
| start_photo_at | timestamptz | | Start photo timestamp |
| end_photo_path | text | | End photo storage path |
| end_photo_at | timestamptz | | End photo timestamp |
| notes | text | | POD notes |
| status | text | NOT NULL, CHECK | 'pending', 'verified', 'rejected' |
| verified_at | timestamptz | | Verification timestamp |
| verified_by | text | | Verifier name |
| created_at | timestamptz | NOT NULL, DEFAULT now() | Creation timestamp |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | Update timestamp |

**Indexes**: `pods_driver_id_idx`, `pods_status_idx`, `pods_created_at_idx`

---

### Notification Tables

#### `trip_notifications`
Real-time trip notifications for drivers.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | Primary key |
| driver_email | text | | Driver email |
| driver_id | uuid | FK → drivers.id | Driver reference |
| trip_id | uuid | FK → trips.id CASCADE | Trip reference |
| trip_code | text | | Trip code snapshot |
| type | text | NOT NULL, CHECK | 'trip_assigned', 'trip_unassigned', 'status_changed' |
| title | text | NOT NULL | Notification title |
| body | text | | Notification body |
| read | boolean | NOT NULL, DEFAULT false | Read status |
| created_at | timestamptz | NOT NULL, DEFAULT now() | Creation timestamp |

**Indexes**: 
- `trip_notifications_driver_email_idx`
- `trip_notifications_driver_id_idx`
- `trip_notifications_created_at_idx`

---

#### `notifications`
General notification system for all users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | Primary key |
| user_id | uuid | FK → users.id CASCADE | User reference |
| driver_id | uuid | FK → drivers.id CASCADE | Driver reference |
| trip_id | uuid | FK → trips.id CASCADE | Trip reference |
| type | text | NOT NULL, CHECK | 'trip_assigned', 'trip_completed', 'trip_cancelled', 'trip_delayed', 'payment_received', 'document_expiring', 'system_alert', 'message', 'reminder' |
| title | text | NOT NULL | Notification title |
| body | text | | Notification body |
| data | jsonb | DEFAULT '{}' | Additional data |
| priority | text | NOT NULL, CHECK | 'low', 'normal', 'high', 'urgent' |
| read | boolean | NOT NULL, DEFAULT false | Read status |
| read_at | timestamptz | | Read timestamp |
| action_url | text | | Action URL |
| created_at | timestamptz | NOT NULL, DEFAULT now() | Creation timestamp |
| expires_at | timestamptz | | Expiration timestamp |

**Indexes**: 
- `notifications_user_id_idx`
- `notifications_driver_id_idx`
- `notifications_type_idx`
- `notifications_read_idx`
- `notifications_created_at_idx`
- `notifications_priority_idx`

---

## Views

### `earnings_summary`
Pre-aggregated earnings statistics per driver.

```sql
SELECT 
  driver_id, driver_code, driver_name,
  total_earnings, pending_earnings, paid_earnings,
  earnings_count, last_earning_date
FROM earnings_summary;
```

### `trip_revenue_summary`
Pre-joined trip data with driver and vehicle info for admin dashboards.

```sql
SELECT 
  trip_id, trip_code, pickup_location, drop_location,
  status, fare_amount, driver_earnings, payment_status,
  driver_name, driver_code, vehicle_number, vehicle_model
FROM trip_revenue_summary;
```

---

## Functions

### `update_updated_at_column()`
Trigger function to auto-update `updated_at` timestamp on UPDATE.

### `calculate_driver_earnings(fare, percentage)`
Calculates driver earnings from fare amount.

```sql
SELECT calculate_driver_earnings(100.00, 75.0); -- Returns 75.00
```

### `generate_driver_code()`
Generates the next sequential driver code (DRV-XXXX).

### `generate_trip_code()`
Generates the next sequential trip code (TRP-XXXX).

### `generate_vehicle_number()`
Generates the next sequential vehicle number (VHC-XXXX).

### `cleanup_expired_notifications()`
Removes expired notifications from the notifications table.

---

## Row Level Security (RLS)

All tables have RLS enabled with open policies (`USING (true)`) because:
1. The application uses its own JWT-based authentication
2. Access control is enforced at the application layer
3. This allows the frontend Supabase client full CRUD access

### Policy Pattern (applied to all tables)

```sql
-- SELECT
CREATE POLICY "anon_select_{table}" ON {table} FOR SELECT
  TO anon, authenticated USING (true);

-- INSERT
CREATE POLICY "anon_insert_{table}" ON {table} FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- UPDATE
CREATE POLICY "anon_update_{table}" ON {table} FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- DELETE
CREATE POLICY "anon_delete_{table}" ON {table} FOR DELETE
  TO anon, authenticated USING (true);
```

---

## Realtime Support

The following tables are enabled for Supabase Realtime:

- `trips` - Live trip status updates
- `trip_notifications` - Instant driver notifications
- `notifications` - General user notifications
- `driver_earnings` - Live earnings updates
- `drivers` - Driver profile changes
- `vehicles` - Vehicle status updates
- `pods` - POD verification updates

### Client Subscription Example

```typescript
const channel = supabase
  .channel('trip-updates')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'trips' },
    (payload) => console.log(payload)
  )
  .subscribe();
```

---

## Storage

### `pods` Bucket
- Public read access (thumbnails render without signed URLs)
- Full CRUD for anon/authenticated clients
- Stores: Start/end photos for proof of delivery

---

## Migration History

1. `20260620063626` - Create drivers table
2. `20260620065749` - Create vehicles and assignments tables
3. `20260620070315` - Create pods table and storage
4. `20260620070843` - Create trips tables
5. `20260620071900` - Enable realtime and trip_notifications
6. `20260620073859` - Create revenue and earnings tables
7. `20260620080100` - Complete database schema (users, notifications, enhanced earnings)

---

## Index Usage Guidelines

### Common Query Patterns and Recommended Indexes

| Query | Recommended Index |
|-------|------------------|
| Driver by status | `drivers_status_idx` |
| Active trips by driver | `trips_driver_status_idx` |
| Trips by date range | `trips_date_status_idx` |
| Earnings by driver+date | `driver_earnings_driver_status_date_idx` |
| Unread notifications | `notifications_read_idx` |

---

## Database Maintenance

### Regular Tasks

1. **Vacuum Analysis**: Run `VACUUM ANALYZE` periodically
2. **Expired Notifications**: Call `cleanup_expired_notifications()`
3. **Index Review**: Monitor unused indexes
4. **Connection Pooling**: Use connection pooling for production

---

## Backup Strategy

1. **Point-in-Time Recovery**: Enabled by default in Supabase
2. **Daily Backups**: Automatic with Supabase Pro
3. **Export Scripts**: Use `pg_dump` for additional backups

---

*Last updated: 2026-06-20*
