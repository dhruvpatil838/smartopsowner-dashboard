import { supabase } from "@/lib/supabase";
import { z } from "zod";

export type DriverStatus = "active" | "inactive" | "on_leave";

export interface Driver {
  id: string;
  driver_code: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  license_number: string | null;
  license_expiry: string | null;
  vehicle_assigned: string | null;
  joining_date: string | null;
  status: DriverStatus;
  profile_photo: string | null;
  created_at: string;
  updated_at: string;
}

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
  page?: number;
  pageSize?: number;
}

export interface DriverListResult {
  rows: Driver[];
  total: number;
}

// Validation schema for driver input
export const DriverInputSchema = z.object({
  full_name: z.string().min(2, "Full name must be at least 2 characters").max(100, "Full name is too long"),
  driver_code: z.string().optional(),
  email: z.string().email("Invalid email format").optional().or(z.literal("")),
  phone: z.string()
    .regex(/^[\d\s\-\+\(\)]{0,20}$/, "Invalid phone format")
    .optional()
    .or(z.literal("")),
  address: z.string().max(500, "Address is too long").optional().or(z.literal("")),
  license_number: z.string().max(50, "License number is too long").optional().or(z.literal("")),
  license_expiry: z.string().optional().or(z.literal("")),
  vehicle_assigned: z.string().max(50, "Vehicle ID is too long").optional().or(z.literal("")),
  joining_date: z.string().optional().or(z.literal("")),
  status: z.enum(["active", "inactive", "on_leave"]),
  profile_photo: z.string()
    .url("Invalid photo URL")
    .optional()
    .or(z.literal("")),
});

export type DriverInput = z.infer<typeof DriverInputSchema>;

export type ValidationError = { field: string; message: string };

const TABLE = "drivers";

// Sanitize string input to prevent XSS
function sanitizeString(str: string | null | undefined): string {
  if (!str) return "";
  return str.trim().slice(0, 500);
}

function nextDriverCode(existing: string[]): string {
  let max = 0;
  for (const code of existing) {
    const m = /DRV-(\d+)/.exec(code);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `DRV-${String(max + 1).padStart(4, "0")}`;
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
      const sanitizedSearch = search.replace(/[%_]/g, "\\$&");
      query = query.or(
        `full_name.ilike.%${sanitizedSearch}%,email.ilike.%${sanitizedSearch}%,phone.ilike.%${sanitizedSearch}%,driver_code.ilike.%${sanitizedSearch}%,license_number.ilike.%${sanitizedSearch}%,vehicle_assigned.ilike.%${sanitizedSearch}%`,
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
    // Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw new Error("Invalid driver ID format");
    }
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as Driver | null;
  },

  async create(input: DriverInput): Promise<Driver> {
    // Validate input
    const validated = DriverInputSchema.safeParse(input);
    if (!validated.success) {
      const errors = validated.error.errors.map(e => ({
        field: e.path.join("."),
        message: e.message,
      }));
      throw new ValidationErrorMap(errors);
    }

    // Sanitize inputs
    const sanitizedInput = {
      ...validated.data,
      full_name: sanitizeString(validated.data.full_name),
      email: sanitizeString(validated.data.email) || null,
      phone: sanitizeString(validated.data.phone) || null,
      address: sanitizeString(validated.data.address) || null,
      license_number: sanitizeString(validated.data.license_number) || null,
      vehicle_assigned: sanitizeString(validated.data.vehicle_assigned) || null,
    };

    // Ensure driver_code is set & unique
    if (!sanitizedInput.driver_code) {
      const { data: existing } = await supabase.from(TABLE).select("driver_code");
      sanitizedInput.driver_code = nextDriverCode((existing ?? []).map((r) => r.driver_code));
    }

    const { data, error } = await supabase
      .from(TABLE)
      .insert(sanitizedInput as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as Driver;
  },

  async update(id: string, patch: Partial<DriverInput>): Promise<Driver> {
    // Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw new Error("Invalid driver ID format");
    }

    // Validate input
    const validated = DriverInputSchema.partial().safeParse(patch);
    if (!validated.success) {
      const errors = validated.error.errors.map(e => ({
        field: e.path.join("."),
        message: e.message,
      }));
      throw new ValidationErrorMap(errors);
    }

    // Sanitize inputs
    const sanitizedPatch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(validated.data)) {
      if (typeof value === "string") {
        sanitizedPatch[key] = sanitizeString(value) || null;
      } else {
        sanitizedPatch[key] = value;
      }
    }

    const { data, error } = await supabase
      .from(TABLE)
      .update({ ...sanitizedPatch, updated_at: new Date().toISOString() } as never)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as Driver;
  },

  async remove(id: string): Promise<void> {
    // Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw new Error("Invalid driver ID format");
    }
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) throw new Error(error.message);
  },

  async checkEmailExists(email: string, excludeId?: string): Promise<boolean> {
    if (!email) return false;
    let query = supabase.from(TABLE).select("id").eq("email", email);
    if (excludeId) query = query.neq("id", excludeId);
    const { data } = await query.maybeSingle();
    return !!data;
  },

  async checkLicenseExists(licenseNumber: string, excludeId?: string): Promise<boolean> {
    if (!licenseNumber) return false;
    let query = supabase.from(TABLE).select("id").eq("license_number", licenseNumber);
    if (excludeId) query = query.neq("id", excludeId);
    const { data } = await query.maybeSingle();
    return !!data;
  },

  async getStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    onLeave: number;
  }> {
    const { data, error } = await supabase.from(TABLE).select("status");
    if (error) throw new Error(error.message);

    const drivers = data ?? [];
    return {
      total: drivers.length,
      active: drivers.filter(d => d.status === "active").length,
      inactive: drivers.filter(d => d.status === "inactive").length,
      onLeave: drivers.filter(d => d.status === "on_leave").length,
    };
  },
};

// Custom error class for validation errors
export class ValidationErrorMap extends Error {
  constructor(public errors: ValidationError[]) {
    super("Validation failed");
    this.name = "ValidationErrorMap";
  }
}
