import { supabase } from "@/lib/supabase";
import type { Driver } from "@/lib/driverApi";

export type PodStatus = "pending" | "verified" | "rejected";
export type PodStage = "start" | "end";

export interface Pod {
  id: string;
  trip_code: string | null;
  driver_id: string | null;
  driver_name: string;
  start_photo_path: string | null;
  start_photo_at: string | null;
  end_photo_path: string | null;
  end_photo_at: string | null;
  notes: string | null;
  status: PodStatus;
  verified_at: string | null;
  verified_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PodListParams {
  search?: string;
  status?: PodStatus | "";
  page?: number;
  pageSize?: number;
}

export interface PodListResult {
  rows: Pod[];
  total: number;
}

const TABLE = "pods";
const BUCKET = "pods";

export const podApi = {
  publicUrl(path: string | null): string | null {
    if (!path) return null;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  },

  async uploadPhoto(
    file: File,
    driverId: string | null,
    stage: PodStage,
  ): Promise<string> {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const folder = stage === "start" ? "start" : "end";
    const stamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const path = `${folder}/${driverId ?? "anon"}-${stamp}-${rand}.${ext}`;

    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "image/jpeg",
    });
    if (error) throw new Error(error.message);
    return path;
  },

  async createSignedDownloadUrl(path: string): Promise<string> {
    const { data, error } = await supabase
      .storage
      .from(BUCKET)
      .createSignedUrl(path, 60, { download: true });
    if (error) throw new Error(error.message);
    return data.signedUrl;
  },

  async list(params: PodListParams = {}): Promise<PodListResult> {
    const { search = "", status = "", page = 1, pageSize = 9 } = params;
    let query = supabase.from(TABLE).select("*", { count: "exact" });

    if (search.trim()) {
      const s = search.trim();
      query = query.or(`driver_name.ilike.%${s}%,trip_code.ilike.%${s}%`);
    }
    if (status) query = query.eq("status", status);

    query = query.order("created_at", { ascending: false });

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as Pod[], total: count ?? 0 };
  },

  async listForDriver(driverId: string): Promise<Pod[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("driver_id", driverId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Pod[];
  },

  async get(id: string): Promise<Pod | null> {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as Pod | null;
  },

  async create(input: {
    trip_code?: string | null;
    driver_id?: string | null;
    driver_name: string;
    notes?: string | null;
  }): Promise<Pod> {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(input as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as Pod;
  },

  async attachPhoto(
    id: string,
    stage: PodStage,
    path: string,
  ): Promise<Pod> {
    const col = stage === "start" ? "start_photo_path" : "end_photo_path";
    const timeCol = stage === "start" ? "start_photo_at" : "end_photo_at";
    const patch = {
      [col]: path,
      [timeCol]: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from(TABLE)
      .update(patch as never)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as Pod;
  },

  async updateNotes(id: string, notes: string): Promise<Pod> {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ notes, updated_at: new Date().toISOString() } as never)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as Pod;
  },

  async verify(id: string, status: "verified" | "rejected", by: string): Promise<Pod> {
    const patch = {
      status,
      verified_at: new Date().toISOString(),
      verified_by: by,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from(TABLE)
      .update(patch as never)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as Pod;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) throw new Error(error.message);
  },

  async listDrivers(): Promise<Driver[]> {
    const { data, error } = await supabase
      .from("drivers")
      .select("*")
      .order("full_name", { ascending: true });
    if (error) throw new Error(error.message);
    return data as Driver[];
  },
};
