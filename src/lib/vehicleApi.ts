import { supabase } from "@/lib/supabase";
import type { Driver } from "@/lib/driverApi";

export type VehicleType = "truck" | "van" | "trailer" | "bus" | "car";
export type VehicleStatus = "active" | "idle" | "maintenance" | "retired";
export type AssignmentAction = "assigned" | "unassigned";

export interface VehicleRow {
  id: string;
  vehicle_number: string;
  vehicle_type: VehicleType;
  model: string;
  registration_number: string;
  insurance_expiry: string | null; // ISO date
  capacity: number; // kg
  status: VehicleStatus;
  assigned_driver_id: string | null;
  drivers: Pick<Driver, "id" | "full_name" | "driver_code"> | null;
  created_at: string;
  updated_at: string;
}

export interface VehicleAssignment {
  id: string;
  vehicle_id: string;
  driver_id: string | null;
  driver_name: string;
  action: AssignmentAction;
  note: string | null;
  created_at: string;
}

export type VehicleInput = Omit<
  VehicleRow,
  "id" | "created_at" | "updated_at" | "drivers" | "assigned_driver_id"
> & { assigned_driver_id?: string | null };

export type VehicleSortKey =
  | "vehicle_number"
  | "vehicle_type"
  | "model"
  | "registration_number"
  | "insurance_expiry"
  | "capacity"
  | "status"
  | "created_at";

export interface VehicleListParams {
  search?: string;
  status?: VehicleStatus | "";
  type?: VehicleType | "";
  sort?: VehicleSortKey;
  ascending?: boolean;
  page?: number;
  pageSize?: number;
}

export interface VehicleListResult {
  rows: VehicleRow[];
  total: number;
}

const TABLE = "vehicles";

export const vehicleApi = {
  async list(params: VehicleListParams = {}): Promise<VehicleListResult> {
    const {
      search = "",
      status = "",
      type = "",
      sort = "created_at",
      ascending = false,
      page = 1,
      pageSize = 10,
    } = params;

    let query = supabase
      .from(TABLE)
      .select("*, drivers:assigned_driver_id(id, full_name, driver_code)", {
        count: "exact",
      });

    if (search.trim()) {
      const s = search.trim();
      query = query.or(
        `vehicle_number.ilike.%${s}%,model.ilike.%${s}%,registration_number.ilike.%${s}%`,
      );
    }
    if (status) query = query.eq("status", status);
    if (type) query = query.eq("vehicle_type", type);

    query = query.order(sort, { ascending });

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);
    return {
      rows: (data ?? []) as unknown as VehicleRow[],
      total: count ?? 0,
    };
  },

  async get(id: string): Promise<VehicleRow | null> {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*, drivers:assigned_driver_id(id, full_name, driver_code)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as unknown as VehicleRow | null;
  },

  async create(input: VehicleInput): Promise<VehicleRow> {
    const { assigned_driver_id, ...rest } = input;
    const payload = { ...rest, assigned_driver_id: assigned_driver_id ?? null };
    const { data, error } = await supabase
      .from(TABLE)
      .insert(payload as never)
      .select("*, drivers:assigned_driver_id(id, full_name, driver_code)")
      .single();
    if (error) throw new Error(error.message);
    return data as unknown as VehicleRow;
  },

  async update(id: string, patch: Partial<VehicleInput>): Promise<VehicleRow> {
    const { assigned_driver_id, ...rest } = patch;
    const payload: Record<string, unknown> = { ...rest, updated_at: new Date().toISOString() };
    if (assigned_driver_id !== undefined) payload.assigned_driver_id = assigned_driver_id ?? null;
    const { data, error } = await supabase
      .from(TABLE)
      .update(payload as never)
      .eq("id", id)
      .select("*, drivers:assigned_driver_id(id, full_name, driver_code)")
      .single();
    if (error) throw new Error(error.message);
    return data as unknown as VehicleRow;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) throw new Error(error.message);
  },

  /**
   * Assign (or reassign) a driver to a vehicle. Writes a history record and
   * un-assigns any previous driver on this vehicle (also recorded in history).
   */
  async assignDriver(
    vehicleId: string,
    driver: { id: string; full_name: string } | null,
  ): Promise<VehicleRow> {
    // Read current assignment so we can log an "unassigned" history entry if needed.
    const current = await this.get(vehicleId);
    const history: Omit<VehicleAssignment, "id">[] = [];

    if (current?.drivers && current.drivers.id !== driver?.id) {
      history.push({
        vehicle_id: vehicleId,
        driver_id: current.assigned_driver_id,
        driver_name: current.drivers.full_name,
        action: "unassigned",
        note: "Replaced by new assignment",
        created_at: new Date().toISOString(),
      });
    }

    const updated = await this.update(vehicleId, {
      assigned_driver_id: driver?.id ?? null,
    });

    if (driver) {
      history.push({
        vehicle_id: vehicleId,
        driver_id: driver.id,
        driver_name: driver.full_name,
        action: "assigned",
        note: null,
        created_at: new Date().toISOString(),
      });
    }

    if (history.length) {
      const { error: hErr } = await supabase
        .from("vehicle_assignments")
        .insert(history as never);
      if (hErr) throw new Error(hErr.message);
    }

    return updated;
  },

  async history(vehicleId: string): Promise<VehicleAssignment[]> {
    const { data, error } = await supabase
      .from("vehicle_assignments")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as VehicleAssignment[];
  },

  async availableDrivers(): Promise<Driver[]> {
    // Show all drivers so the picker can also reassign to already-busy ones.
    // We don't filter by status because a manager may need to reassign on the fly.
    const { data, error } = await supabase
      .from("drivers")
      .select("*")
      .order("full_name", { ascending: true });
    if (error) throw new Error(error.message);
    return data as Driver[];
  },
};
