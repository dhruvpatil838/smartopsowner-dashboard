import { api } from "@/lib/api";

export type DriverStatus = "active" | "inactive";

export interface DriverRecord {
  _id: string;
  name: string;
  phone: string;
  licenseNumber: string;
  vehicleAssigned: string;
  status: DriverStatus;
  tripsCompleted: number;
  createdAt: string;
  updatedAt: string;
}

export interface DriverListParams {
  search?: string;
  status?: DriverStatus | "";
}

export type DriverInput = {
  name: string;
  phone: string;
  licenseNumber: string;
  vehicleAssigned?: string;
  status?: DriverStatus;
  tripsCompleted?: number;
};

export const driverManagementApi = {
  list: (params: DriverListParams = {}) => {
    const qs = new URLSearchParams();
    if (params.search?.trim()) qs.set("search", params.search.trim());
    if (params.status) qs.set("status", params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    // noCache so search/filter always reflects server state
    return api<DriverRecord[]>(`/driver-management${suffix}`, { noCache: true });
  },

  get: (id: string) => api<DriverRecord>(`/driver-management/${id}`, { noCache: true }),

  create: (body: DriverInput) =>
    api<DriverRecord>("/driver-management", { method: "POST", body }),

  update: (id: string, body: Partial<DriverInput>) =>
    api<DriverRecord>(`/driver-management/${id}`, { method: "PUT", body }),

  remove: (id: string) =>
    api<{ ok: true }>(`/driver-management/${id}`, { method: "DELETE" }),
};
