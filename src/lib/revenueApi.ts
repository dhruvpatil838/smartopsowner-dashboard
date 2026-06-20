import { supabase } from "@/lib/supabase";
import { format, startOfMonth, endOfMonth, subMonths, parseISO, startOfYear, endOfYear } from "date-fns";

export type PaymentStatus = "pending" | "paid" | "refunded" | "cancelled";
export type EarningsType = "trip_earnings" | "bonus" | "adjustment" | "penalty" | "tip";
export type EarningsStatus = "pending" | "paid" | "cancelled";
export type TransactionType = "trip_revenue" | "refund" | "adjustment" | "bonus";

export interface TripRevenue {
  id: string;
  trip_code: string;
  pickup_location: string;
  drop_location: string;
  scheduled_date: string | null;
  fare_amount: number;
  driver_earnings: number;
  base_fare: number;
  distance_charge: number;
  waiting_charge: number;
  distance_km: number | null;
  payment_status: PaymentStatus;
  completed_at: string | null;
  created_at: string;
  driver_id: string | null;
  driver_name: string | null;
  driver_code: string | null;
  vehicle_id: string | null;
  vehicle_number: string | null;
}

export interface DriverEarningsRecord {
  id: string;
  driver_id: string;
  trip_id: string | null;
  trip_code: string | null;
  amount: number;
  earnings_type: EarningsType;
  status: EarningsStatus;
  description: string | null;
  earned_date: string;
  paid_at: string | null;
  created_at: string;
}

export interface RevenueStats {
  totalRevenue: number;
  monthlyRevenue: number;
  totalTrips: number;
  completedTrips: number;
  pendingPayments: number;
  averageFare: number;
  totalDriverEarnings: number;
  monthlyDriverEarnings: number;
}

export interface MonthlyRevenue {
  month: string;
  revenue: number;
  driverEarnings: number;
  trips: number;
}

export interface RevenueByDriver {
  driver_id: string;
  driver_name: string;
  driver_code: string;
  total_revenue: number;
  total_trips: number;
  total_earnings: number;
}

export interface RevenueByVehicle {
  vehicle_id: string;
  vehicle_number: string;
  model: string;
  total_revenue: number;
  total_trips: number;
}

export interface TripEarningsBreakdown {
  trip_id: string;
  trip_code: string;
  pickup_location: string;
  drop_location: string;
  completed_at: string | null;
  fare_amount: number;
  driver_earnings: number;
  base_fare: number;
  distance_charge: number;
  waiting_charge: number;
  distance_km: number | null;
  payment_status: PaymentStatus;
}

export interface DateRangeParams {
  startDate?: string;
  endDate?: string;
}

const TRIPS_TABLE = "trips";
const DRIVER_EARNINGS_TABLE = "driver_earnings";
const REVENUE_TRANSACTIONS_TABLE = "revenue_transactions";

export const revenueApi = {
  // ================== ADMIN REVENANCE APIS ==================

  /** Get overall revenue statistics */
  async getStats(params: DateRangeParams = {}): Promise<RevenueStats> {
    const { startDate, endDate } = params;

    let query = supabase
      .from(TRIPS_TABLE)
      .select("fare_amount, driver_earnings, payment_status, status", { count: "exact" });

    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    const { data: trips, error } = await query;
    if (error) throw new Error(error.message);

    const totalRevenue = trips?.reduce((sum, t) => sum + (Number(t.fare_amount) || 0), 0) || 0;
    const totalDriverEarnings = trips?.reduce((sum, t) => sum + (Number(t.driver_earnings) || 0), 0) || 0;
    const pendingPayments = trips?.filter(t => t.payment_status === "pending").reduce((sum, t) => sum + (Number(t.fare_amount) || 0), 0) || 0;
    const completedTrips = trips?.filter(t => t.status === "completed").length || 0;
    const totalTrips = trips?.length || 0;
    const averageFare = totalTrips > 0 ? totalRevenue / totalTrips : 0;

    // Monthly stats
    const now = new Date();
    const monthStart = startOfMonth(now).toISOString();
    const monthEnd = endOfMonth(now).toISOString();

    const { data: monthlyTrips } = await supabase
      .from(TRIPS_TABLE)
      .select("fare_amount, driver_earnings")
      .gte("created_at", monthStart)
      .lte("created_at", monthEnd);

    const monthlyRevenue = monthlyTrips?.reduce((sum, t) => sum + (Number(t.fare_amount) || 0), 0) || 0;
    const monthlyDriverEarnings = monthlyTrips?.reduce((sum, t) => sum + (Number(t.driver_earnings) || 0), 0) || 0;

    return {
      totalRevenue,
      monthlyRevenue,
      totalTrips,
      completedTrips,
      pendingPayments,
      averageFare,
      totalDriverEarnings,
      monthlyDriverEarnings,
    };
  },

  /** Get monthly revenue trends (last 12 months) */
  async getMonthlyRevenue(months: number = 12): Promise<MonthlyRevenue[]> {
    const now = new Date();
    const results: MonthlyRevenue[] = [];

    for (let i = months - 1; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate).toISOString();
      const monthEnd = endOfMonth(monthDate).toISOString();
      const monthLabel = format(monthDate, "MMM yyyy");

      const { data: trips, error } = await supabase
        .from(TRIPS_TABLE)
        .select("fare_amount, driver_earnings, status")
        .gte("created_at", monthStart)
        .lte("created_at", monthEnd);

      if (error) throw new Error(error.message);

      results.push({
        month: monthLabel,
        revenue: trips?.reduce((sum, t) => sum + (Number(t.fare_amount) || 0), 0) || 0,
        driverEarnings: trips?.reduce((sum, t) => sum + (Number(t.driver_earnings) || 0), 0) || 0,
        trips: trips?.filter(t => t.status === "completed").length || 0,
      });
    }

    return results;
  },

  /** Get revenue breakdown by driver */
  async getRevenueByDriver(params: DateRangeParams & { limit?: number } = {}): Promise<RevenueByDriver[]> {
    const { startDate, endDate, limit = 10 } = params;

    let query = supabase
      .from(TRIPS_TABLE)
      .select(`
        fare_amount,
        driver_earnings,
        assigned_driver_id,
        drivers:assigned_driver_id(id, full_name, driver_code)
      `)
      .not("assigned_driver_id", "is", null);

    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    const { data: trips, error } = await query;
    if (error) throw new Error(error.message);

    // Aggregate by driver
    const driverMap = new Map<string, RevenueByDriver>();

    trips?.forEach(trip => {
      const driver = trip.drivers as { id: string; full_name: string; driver_code: string } | null;
      if (!driver) return;

      const existing = driverMap.get(driver.id);
      if (existing) {
        existing.total_revenue += Number(trip.fare_amount) || 0;
        existing.total_earnings += Number(trip.driver_earnings) || 0;
        existing.total_trips += 1;
      } else {
        driverMap.set(driver.id, {
          driver_id: driver.id,
          driver_name: driver.full_name,
          driver_code: driver.driver_code,
          total_revenue: Number(trip.fare_amount) || 0,
          total_earnings: Number(trip.driver_earnings) || 0,
          total_trips: 1,
        });
      }
    });

    return Array.from(driverMap.values())
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, limit);
  },

  /** Get revenue breakdown by vehicle */
  async getRevenueByVehicle(params: DateRangeParams & { limit?: number } = {}): Promise<RevenueByVehicle[]> {
    const { startDate, endDate, limit = 10 } = params;

    let query = supabase
      .from(TRIPS_TABLE)
      .select(`
        fare_amount,
        assigned_vehicle_id,
        vehicles:assigned_vehicle_id(id, vehicle_number, model)
      `)
      .not("assigned_vehicle_id", "is", null);

    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    const { data: trips, error } = await query;
    if (error) throw new Error(error.message);

    // Aggregate by vehicle
    const vehicleMap = new Map<string, RevenueByVehicle>();

    trips?.forEach(trip => {
      const vehicle = trip.vehicles as { id: string; vehicle_number: string; model: string } | null;
      if (!vehicle) return;

      const existing = vehicleMap.get(vehicle.id);
      if (existing) {
        existing.total_revenue += Number(trip.fare_amount) || 0;
        existing.total_trips += 1;
      } else {
        vehicleMap.set(vehicle.id, {
          vehicle_id: vehicle.id,
          vehicle_number: vehicle.vehicle_number,
          model: vehicle.model,
          total_revenue: Number(trip.fare_amount) || 0,
          total_trips: 1,
        });
      }
    });

    return Array.from(vehicleMap.values())
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, limit);
  },

  /** Get detailed trip revenue list */
  async getTripRevenueList(params: {
    search?: string;
    paymentStatus?: PaymentStatus | "";
    driverId?: string;
    vehicleId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<{ rows: TripRevenue[]; total: number }> {
    const {
      search = "",
      paymentStatus = "",
      driverId = "",
      vehicleId = "",
      startDate = "",
      endDate = "",
      page = 1,
      pageSize = 10,
    } = params;

    let query = supabase
      .from(TRIPS_TABLE)
      .select(`
        id,
        trip_code,
        pickup_location,
        drop_location,
        scheduled_date,
        fare_amount,
        driver_earnings,
        base_fare,
        distance_charge,
        waiting_charge,
        distance_km,
        payment_status,
        completed_at,
        created_at,
        assigned_driver_id,
        assigned_vehicle_id,
        drivers:assigned_driver_id(id, full_name, driver_code),
        vehicles:assigned_vehicle_id(id, vehicle_number)
      `, { count: "exact" });

    if (search.trim()) {
      const s = search.trim();
      query = query.or(`trip_code.ilike.%${s}%,pickup_location.ilike.%${s}%,drop_location.ilike.%${s}%`);
    }
    if (paymentStatus) {
      query = query.eq("payment_status", paymentStatus);
    }
    if (driverId) {
      query = query.eq("assigned_driver_id", driverId);
    }
    if (vehicleId) {
      query = query.eq("assigned_vehicle_id", vehicleId);
    }
    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to).order("created_at", { ascending: false });

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    const rows = (data ?? []).map(trip => {
      const driver = trip.drivers as { id: string; full_name: string; driver_code: string } | null;
      const vehicle = trip.vehicles as { id: string; vehicle_number: string } | null;
      return {
        id: trip.id,
        trip_code: trip.trip_code,
        pickup_location: trip.pickup_location,
        drop_location: trip.drop_location,
        scheduled_date: trip.scheduled_date,
        fare_amount: Number(trip.fare_amount) || 0,
        driver_earnings: Number(trip.driver_earnings) || 0,
        base_fare: Number(trip.base_fare) || 0,
        distance_charge: Number(trip.distance_charge) || 0,
        waiting_charge: Number(trip.waiting_charge) || 0,
        distance_km: trip.distance_km,
        payment_status: trip.payment_status as PaymentStatus,
        completed_at: trip.completed_at,
        created_at: trip.created_at,
        driver_id: trip.assigned_driver_id,
        driver_name: driver?.full_name ?? null,
        driver_code: driver?.driver_code ?? null,
        vehicle_id: trip.assigned_vehicle_id,
        vehicle_number: vehicle?.vehicle_number ?? null,
      };
    });

    return { rows, total: count ?? 0 };
  },

  /** Update trip fare and earnings */
  async updateTripFare(
    tripId: string,
    data: {
      fare_amount: number;
      driver_earnings: number;
      base_fare?: number;
      distance_charge?: number;
      waiting_charge?: number;
      payment_status?: PaymentStatus;
    }
  ): Promise<void> {
    const { error } = await supabase
      .from(TRIPS_TABLE)
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tripId);
    if (error) throw new Error(error.message);
  },

  /** Mark trip as paid */
  async markTripPaid(tripId: string): Promise<void> {
    const { error } = await supabase
      .from(TRIPS_TABLE)
      .update({
        payment_status: "paid",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", tripId);
    if (error) throw new Error(error.message);
  },

  // ================== DRIVER EARNINGS APIS ==================

  /** Get driver earnings stats */
  async getDriverStats(driverId: string, params: DateRangeParams = {}): Promise<{
    totalEarnings: number;
    monthlyEarnings: number;
    totalTrips: number;
    completedTrips: number;
    pendingEarnings: number;
    paidEarnings: number;
    averageEarnings: number;
  }> {
    const { startDate, endDate } = params;

    let query = supabase
      .from(TRIPS_TABLE)
      .select("driver_earnings, status, payment_status")
      .eq("assigned_driver_id", driverId);

    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    const { data: trips, error } = await query;
    if (error) throw new Error(error.message);

    const totalEarnings = trips?.reduce((sum, t) => sum + (Number(t.driver_earnings) || 0), 0) || 0;
    const totalTrips = trips?.length || 0;
    const completedTrips = trips?.filter(t => t.status === "completed").length || 0;
    const pendingEarnings = trips?.filter(t => t.payment_status === "pending").reduce((sum, t) => sum + (Number(t.driver_earnings) || 0), 0) || 0;
    const paidEarnings = trips?.filter(t => t.payment_status === "paid").reduce((sum, t) => sum + (Number(t.driver_earnings) || 0), 0) || 0;
    const averageEarnings = completedTrips > 0 ? totalEarnings / completedTrips : 0;

    // Monthly earnings
    const now = new Date();
    const monthStart = startOfMonth(now).toISOString();
    const monthEnd = endOfMonth(now).toISOString();

    const { data: monthlyTrips } = await supabase
      .from(TRIPS_TABLE)
      .select("driver_earnings")
      .eq("assigned_driver_id", driverId)
      .gte("created_at", monthStart)
      .lte("created_at", monthEnd);

    const monthlyEarnings = monthlyTrips?.reduce((sum, t) => sum + (Number(t.driver_earnings) || 0), 0) || 0;

    return {
      totalEarnings,
      monthlyEarnings,
      totalTrips,
      completedTrips,
      pendingEarnings,
      paidEarnings,
      averageEarnings,
    };
  },

  /** Get driver's trip-wise earnings */
  async getDriverTripEarnings(driverId: string, params: {
    startDate?: string;
    endDate?: string;
    paymentStatus?: PaymentStatus | "";
  } = {}): Promise<TripEarningsBreakdown[]> {
    const { startDate, endDate, paymentStatus } = params;

    let query = supabase
      .from(TRIPS_TABLE)
      .select(`
        id,
        trip_code,
        pickup_location,
        drop_location,
        completed_at,
        fare_amount,
        driver_earnings,
        base_fare,
        distance_charge,
        waiting_charge,
        distance_km,
        payment_status,
        status
      `)
      .eq("assigned_driver_id", driverId)
      .order("created_at", { ascending: false });

    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      query = query.lte("created_at", endDate);
    }
    if (paymentStatus) {
      query = query.eq("payment_status", paymentStatus);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return (data ?? [])
      .filter(t => t.status === "completed")
      .map(trip => ({
        trip_id: trip.id,
        trip_code: trip.trip_code,
        pickup_location: trip.pickup_location,
        drop_location: trip.drop_location,
        completed_at: trip.completed_at,
        fare_amount: Number(trip.fare_amount) || 0,
        driver_earnings: Number(trip.driver_earnings) || 0,
        base_fare: Number(trip.base_fare) || 0,
        distance_charge: Number(trip.distance_charge) || 0,
        waiting_charge: Number(trip.waiting_charge) || 0,
        distance_km: trip.distance_km,
        payment_status: trip.payment_status as PaymentStatus,
      }));
  },

  /** Get driver's monthly earnings trend */
  async getDriverMonthlyEarnings(driverId: string, months: number = 12): Promise<MonthlyRevenue[]> {
    const now = new Date();
    const results: MonthlyRevenue[] = [];

    for (let i = months - 1; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate).toISOString();
      const monthEnd = endOfMonth(monthDate).toISOString();
      const monthLabel = format(monthDate, "MMM yyyy");

      const { data: trips, error } = await supabase
        .from(TRIPS_TABLE)
        .select("fare_amount, driver_earnings, status")
        .eq("assigned_driver_id", driverId)
        .gte("created_at", monthStart)
        .lte("created_at", monthEnd);

      if (error) throw new Error(error.message);

      results.push({
        month: monthLabel,
        revenue: trips?.reduce((sum, t) => sum + (Number(t.fare_amount) || 0), 0) || 0,
        driverEarnings: trips?.reduce((sum, t) => sum + (Number(t.driver_earnings) || 0), 0) || 0,
        trips: trips?.filter(t => t.status === "completed").length || 0,
      });
    }

    return results;
  },

  /** Get additional driver earnings (bonus, adjustments, etc.) */
  async getDriverAdditionalEarnings(driverId: string): Promise<DriverEarningsRecord[]> {
    const { data, error } = await supabase
      .from(DRIVER_EARNINGS_TABLE)
      .select(`
        id,
        driver_id,
        trip_id,
        amount,
        earnings_type,
        status,
        description,
        earned_date,
        paid_at,
        created_at,
        trips:trip_id(trip_code)
      `)
      .eq("driver_id", driverId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return (data ?? []).map(record => ({
      id: record.id,
      driver_id: record.driver_id,
      trip_id: record.trip_id,
      trip_code: (record.trips as { trip_code: string } | null)?.trip_code ?? null,
      amount: Number(record.amount) || 0,
      earnings_type: record.earnings_type as EarningsType,
      status: record.status as EarningsStatus,
      description: record.description,
      earned_date: record.earned_date,
      paid_at: record.paid_at,
      created_at: record.created_at,
    }));
  },

  /** Add bonus/adjustment for driver (admin only) */
  async addDriverEarnings(
    driverId: string,
    data: {
      amount: number;
      earnings_type: EarningsType;
      description?: string;
      trip_id?: string;
    }
  ): Promise<void> {
    const { error } = await supabase
      .from(DRIVER_EARNINGS_TABLE)
      .insert({
        driver_id: driverId,
        trip_id: data.trip_id ?? null,
        amount: data.amount,
        earnings_type: data.earnings_type,
        description: data.description ?? null,
        earned_date: new Date().toISOString().split('T')[0],
        status: "pending",
      });
    if (error) throw new Error(error.message);
  },

  /** Mark driver earnings as paid */
  async markDriverEarningsPaid(earningsId: string): Promise<void> {
    const { error } = await supabase
      .from(DRIVER_EARNINGS_TABLE)
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
      })
      .eq("id", earningsId);
    if (error) throw new Error(error.message);
  },

  // ================== EXPORT APIS ==================

  /** Export revenue data to CSV */
  async exportRevenueCSV(params: DateRangeParams = {}): Promise<string> {
    const { rows } = await this.getTripRevenueList({ ...params, pageSize: 1000 });

    const headers = [
      "Trip Code",
      "Pickup",
      "Drop",
      "Date",
      "Fare Amount",
      "Driver Earnings",
      "Payment Status",
      "Driver",
      "Vehicle",
    ];

    const csvRows = rows.map(row => [
      row.trip_code,
      row.pickup_location,
      row.drop_location,
      row.scheduled_date ?? row.created_at,
      row.fare_amount.toFixed(2),
      row.driver_earnings.toFixed(2),
      row.payment_status,
      row.driver_name ?? "",
      row.vehicle_number ?? "",
    ]);

    const csv = [
      headers.join(","),
      ...csvRows.map(row => row.map(cell => `"${cell}"`).join(",")),
    ].join("\n");

    return csv;
  },

  /** Export driver earnings to CSV */
  async exportDriverEarningsCSV(driverId: string): Promise<string> {
    const trips = await this.getDriverTripEarnings(driverId);
    const additional = await this.getDriverAdditionalEarnings(driverId);

    const tripHeaders = [
      "Trip Code",
      "Route",
      "Date",
      "Fare",
      "Earnings",
      "Base Fare",
      "Distance Charge",
      "Status",
    ];

    const tripRows = trips.map(t => [
      t.trip_code,
      `${t.pickup_location} → ${t.drop_location}`,
      t.completed_at ?? "",
      t.fare_amount.toFixed(2),
      t.driver_earnings.toFixed(2),
      t.base_fare.toFixed(2),
      t.distance_charge.toFixed(2),
      t.payment_status,
    ]);

    const additionalHeaders = [
      "Type",
      "Amount",
      "Description",
      "Date",
      "Status",
    ];

    const additionalRows = additional.map(a => [
      a.earnings_type,
      a.amount.toFixed(2),
      a.description ?? "",
      a.earned_date,
      a.status,
    ]);

    const csv = [
      "TRIP EARNINGS",
      tripHeaders.join(","),
      ...tripRows.map(row => row.map(cell => `"${cell}"`).join(",")),
      "",
      "ADDITIONAL EARNINGS",
      additionalHeaders.join(","),
      ...additionalRows.map(row => row.map(cell => `"${cell}"`).join(",")),
    ].join("\n");

    return csv;
  },
};
