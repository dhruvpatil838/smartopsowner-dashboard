import { supabase } from "@/lib/supabase";

export type DriverStatus = "active" | "inactive" | "on_leave";

export interface Driver {
  id: string;
  driver_code: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  license_number: string | null;
  license_expiry: string | null; // ISO date
  vehicle_assigned: string | null;
  joining_date: string | null; // ISO date
  status: DriverStatus;
  profile_photo: string | null;
  created_at: string;
  updated_at: string;
}

export type DriverInput = Omit<
  Driver,
  "id" | "created_at" | "updated_at"
>;

export type DriverSortKey =
  | "driver_code"
  | "full_name"
  | "email"
  | "phone"
  | "license_expiry"
  | "joining_date"
  | "status"
  | "vehicle_assigned"
  | "created_at";

export interface DriverListParams {
  search?: string;
  status?: DriverStatus | "";
  sort?: DriverSortKey;
  ascending?: boolean;
  page?: number; // 1-indexed
  pageSize?: number;
}

export interface DriverListResult {
  rows: Driver[];
  total: number;
}

const TABLE = "drivers";

function nextDriverCode(existing: string[]): string {
  let max = 0;
  for (const code of existing) {
    const m = /DRV-(\d+)/.exec(code);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `DRV-${String(max + 1).padStart(3, "0")}`;
}

export const driverApi = {
  async list(params: DriverListParams = {}): Promise<DriverListResult> {
    const {
      search = "",
      status = "",
      sort = "created_at" as DriverSortKey,
      ascending = false,
      page = 1,
      pageSize = 10,
    } = params;

    let query = supabase.from(TABLE).select("*", { count: "exact" });

    if (search.trim()) {
      const s = search.trim();
      query = query.or(
        `full_name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%,driver_code.ilike.%${s}%,license_number.ilike.%${s}%,vehicle_assigned.ilike.%${s}%`,
      );
    }
    if (status) query = query.eq("status", status);

    query = query.order(sort, { ascending });

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);
    return {
      rows: (data ?? []) as Driver[],
      total: count ?? 0,
    };
  },

  async get(id: string): Promise<Driver | null> {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as Driver | null;
  },

  async create(input: DriverInput): Promise<Driver> {
    // Ensure driver_code is set & unique.
    if (!input.driver_code) {
      const { data: existing } = await supabase
        .from(TABLE)
        .select("driver_code");
      input.driver_code = nextDriverCode((existing ?? []).map((r) => r.driver_code));
    }

    const { data, error } = await supabase
      .from(TABLE)
      .insert(input as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as Driver;
  },

  async update(id: string, patch: Partial<DriverInput>): Promise<Driver> {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ ...patch, updated_at: new Date().toISOString() } as never)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as Driver;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
};
