import { memo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { currency, currencyCompact } from "@/lib/store";

const STATUS_COLORS: Record<string, string> = {
  pending: "#94a3b8",
  in_transit: "#0ea5e9",
  delivered: "#10b981",
  delayed: "#f59e0b",
  cancelled: "#ef4444",
};

interface RevenuePoint {
  month: string;
  revenue: number;
}

export const RevenueChart = memo(function RevenueChart({ data }: { data: RevenuePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <defs>
          <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#64748b" }} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: "#64748b" }}
          tickFormatter={(v) => currencyCompact(v)}
          width={64}
        />
        <Tooltip
          formatter={(v: number) => [currency(v), "Revenue"]}
          contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
        />
        <Area type="monotone" dataKey="revenue" stroke="#0ea5e9" strokeWidth={2} fill="url(#revFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
});

interface StatusSlice {
  name: string;
  key: string;
  value: number;
  fill: string;
}

export const StatusPieChart = memo(function StatusPieChart({ data }: { data: StatusSlice[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={2}
        >
          {data.map((s) => (
            <Cell key={s.key} fill={s.fill} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
});

interface DriverLoadPoint {
  name: string;
  trips: number;
}

export const DriverLoadChart = memo(function DriverLoadChart({ data }: { data: DriverLoadPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#64748b" }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#64748b" }} width={32} />
        <Tooltip
          cursor={{ fill: "#f1f5f9" }}
          contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
        />
        <Bar dataKey="trips" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
});
