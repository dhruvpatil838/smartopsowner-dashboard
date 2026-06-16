import { api } from "@/lib/api";

export type TripStatus = "pending" | "in_transit" | "delivered" | "delayed" | "cancelled";
export type DeliveryStatus =
  | "pending"
  | "picked_up"
  | "in_transit"
  | "arrived"
  | "delivered"
  | "delayed"
  | "cancelled";

export interface Trip {
  _id: string;
  tripCode: string;
  source: string;
  destination: string;
  vehicleNumber: string;
  startDate: string;
  expectedDelivery?: string;
  status: TripStatus;
  notes?: string;
  distanceKm: number;
  createdAt: string;
}

export interface Delivery {
  _id: string;
  trip?: string;
  customerName: string;
  address: string;
  status: DeliveryStatus;
  photoBase64?: string;
  signatureBase64?: string;
  notes?: string;
  deliveredAt?: string;
  createdAt: string;
}

export interface GPS {
  _id: string;
  lat: number;
  lng: number;
  speedKph: number;
  etaMinutes: number;
  recordedAt: string;
}

export interface Incident {
  _id: string;
  type: string;
  description: string;
  location: string;
  occurredAt: string;
  evidenceBase64?: string;
  status: "open" | "in_review" | "resolved";
  createdAt: string;
}

export interface DriverNotification {
  _id: string;
  type: "trip_assigned" | "delivery_delayed" | "route_change" | "delivery_completed" | "system";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface DriverProfile {
  driver: {
    _id: string;
    employeeId: string;
    licenseNumber: string;
    vehicleAssigned: string;
    joiningDate: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    avatar?: string;
    createdAt: string;
  };
}

export const driverApi = {
  // Profile
  getProfile: () => api<DriverProfile>("/drivers/me"),
  updateProfile: (body: Partial<DriverProfile["driver"]>) =>
    api<{ driver: DriverProfile["driver"] }>("/drivers/me", { method: "PUT", body }),

  // Trips
  listTrips: () => api<Trip[]>("/trips"),
  createTrip: (body: Partial<Trip>) => api<Trip>("/trips", { method: "POST", body }),
  updateTrip: (id: string, body: Partial<Trip>) =>
    api<Trip>(`/trips/${id}`, { method: "PUT", body }),
  setTripStatus: (id: string, status: TripStatus) =>
    api<Trip>(`/trips/${id}/status`, { method: "POST", body: { status } }),
  deleteTrip: (id: string) => api<{ ok: true }>(`/trips/${id}`, { method: "DELETE" }),

  // Deliveries
  listDeliveries: () => api<Delivery[]>("/deliveries"),
  createDelivery: (body: Partial<Delivery>) =>
    api<Delivery>("/deliveries", { method: "POST", body }),
  updateDelivery: (id: string, body: Partial<Delivery>) =>
    api<Delivery>(`/deliveries/${id}`, { method: "PUT", body }),
  confirmDelivery: (
    id: string,
    body: { photoBase64?: string; signatureBase64?: string; notes?: string },
  ) => api<Delivery>(`/deliveries/${id}/confirm`, { method: "POST", body }),
  deleteDelivery: (id: string) =>
    api<{ ok: true }>(`/deliveries/${id}`, { method: "DELETE" }),

  // GPS
  listGps: (limit = 50) => api<GPS[]>(`/gps?limit=${limit}`),
  getCurrentGps: () => api<GPS | null>("/gps/current"),
  postGps: (body: { lat: number; lng: number; speedKph?: number; etaMinutes?: number }) =>
    api<GPS>("/gps", { method: "POST", body }),

  // Incidents
  listIncidents: () => api<Incident[]>("/incidents"),
  createIncident: (body: Partial<Incident>) =>
    api<Incident>("/incidents", { method: "POST", body }),
  updateIncident: (id: string, body: Partial<Incident>) =>
    api<Incident>(`/incidents/${id}`, { method: "PUT", body }),
  deleteIncident: (id: string) =>
    api<{ ok: true }>(`/incidents/${id}`, { method: "DELETE" }),

  // Notifications
  listNotifications: () => api<DriverNotification[]>("/notifications"),
  markRead: (id: string) =>
    api<DriverNotification>(`/notifications/${id}/read`, { method: "POST" }),
  markAllRead: () => api<{ ok: true }>("/notifications/read-all", { method: "POST" }),
  deleteNotification: (id: string) =>
    api<{ ok: true }>(`/notifications/${id}`, { method: "DELETE" }),
};
