import { useEffect, useState, useCallback } from "react";

export function useLocalStore<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [key, value]);

  return [value, setValue] as const;
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function currency(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

/**
 * Compact Indian currency formatting using the Lakh/Crore system.
 *   1,91,800 -> "₹1.91L"
 *   2,50,00,000 -> "₹2.5Cr"
 *   850 -> "₹850"
 */
export function currencyCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(abs >= 1_00_00_000 * 100 ? 0 : 2)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(2)}L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
  reorderLevel: number;
  createdAt: string;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  salary: number;
  status: "paid" | "pending";
  payDate?: string;
}

export interface Vehicle {
  id: string;
  plate: string;
  model: string;
  driver: string;
  status: "active" | "maintenance" | "idle";
  mileage: number;
  lastService: string;
}

export interface ProductionRun {
  id: string;
  product: string;
  line: string;
  target: number;
  produced: number;
  status: "planned" | "running" | "completed";
  date: string;
}
