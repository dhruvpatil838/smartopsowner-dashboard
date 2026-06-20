import { api } from "@/lib/api";

export type TripStatus = "pending" | "in_transit" | "delivered" | "delayed" | "cancelled";
export type TripPriority = "low" | "medium" | "high" | "urgent";

export interface ManagedTrip {
  _id: string;
  owner: string;
  driverId: string | null;
  driverName: string;
  tripCode: string;
  source: string;
  destination: string;
  vehicleNumber: string;
  startDate: string;
  expectedDelivery?: string;
  actualDelivery?: string;
  status: TripStatus;
  notes: string;
  distanceKm: number;
  priority: TripPriority;
  cargoType: string;
  weight: number;
  createdAt: string;
  updatedAt: string;
}

export interface TripListParams {
  search?: string;
  status?: TripStatus | "";
  driverId?: string;
  priority?: TripPriority | "";
  startDate?: string;
  endDate?: string;
}

export interface TripInput {
  driverId?: string;
  driverName: string;
  tripCode: string;
  source: string;
  destination: string;
  vehicleNumber?: string;
  startDate?: string;
  expectedDelivery?: string;
  status?: TripStatus;
  notes?: string;
  distanceKm?: number;
  priority?: TripPriority;
  cargoType?: string;
  weight?: number;
}

export interface TripStats {
  totalTrips: number;
  pendingTrips: number;
  inTransitTrips: number;
  deliveredTrips: number;
  delayedTrips: number;
  totalDrivers: number;
  activeDrivers: number;
  weeklyTrips: number;
  avgTripsPerDriver: number;
  totalDistance: number;
}

export const managedTripsApi = {
  list: (params: TripListParams = {}) => {
    const qs = new URLSearchParams();
    if (params.search?.trim()) qs.set("search", params.search.trim());
    if (params.status) qs.set("status", params.status);
    if (params.driverId) qs.set("driverId", params.driverId);
    if (params.priority) qs.set("priority", params.priority);
    if (params.startDate) qs.set("startDate", params.startDate);
    if (params.endDate) qs.set("endDate", params.endDate);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return api<ManagedTrip[]>(`/managed-trips${suffix}`, { noCache: true });
  },

  stats: () => api<TripStats>("/managed-trips/stats", { noCache: true }),

  get: (id: string) => api<ManagedTrip>(`/managed-trips/${id}`, { noCache: true }),

  create: (body: TripInput) =>
    api<ManagedTrip>("/managed-trips", { method: "POST", body }),

  update: (id: string, body: Partial<TripInput>) =>
    api<ManagedTrip>(`/managed-trips/${id}`, { method: "PUT", body }),

  updateStatus: (id: string, status: TripStatus) =>
    api<ManagedTrip>(`/managed-trips/${id}/status`, { method: "PUT", body: { status } }),

  assignDriver: (id: string, driverId: string) =>
    api<ManagedTrip>(`/managed-trips/${id}/assign`, { method: "PUT", body: { driverId } }),

  remove: (id: string) =>
    api<{ ok: true }>(`/managed-trips/${id}`, { method: "DELETE" }),
};
