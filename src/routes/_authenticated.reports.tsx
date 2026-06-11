import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  HiOutlineCube, HiOutlineUsers, HiOutlineTruck, HiOutlineWrenchScrewdriver,
  HiOutlineBanknotes, HiOutlineChartBar,
} from "react-icons/hi2";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { PageHeader } from "@/components/AppShell";
import { StatCard } from "@/components/DataPage";
import {
  useLocalStore, currency,
  type InventoryItem, type Employee, type Vehicle, type ProductionRun,
} from "@/lib/store";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — SmartOps" }] }),
  component: ReportsPage,
});

const COLORS = ["oklch(0.74 0.13 205)", "oklch(0.55 0.12 230)", "oklch(0.4 0.08 220)", "oklch(0.7 0.1 200)"];

function ReportsPage() {
  const [inv] = useLocalStore<InventoryItem[]>("smartops.inventory", []);
  const [pay] = useLocalStore<Employee[]>("smartops.payroll", []);
  const [fleet] = useLocalStore<Vehicle[]>("smartops.fleet", []);
  const [prod] = useLocalStore<ProductionRun[]>("smartops.production", []);

  const invValue = useMemo(() => inv.reduce((s, i) => s + i.quantity * i.unitPrice, 0), [inv]);
  const payrollTotal = useMemo(() => pay.reduce((s, e) => s + e.salary, 0), [pay]);

  const moduleData = [
    { name: "Inventory", count: inv.length },
    { name: "Payroll", count: pay.length },
    { name: "Fleet", count: fleet.length },
    { name: "Production", count: prod.length },
  ];

  const fleetStatus = [
    { name: "Active", value: fleet.filter((v) => v.status === "active").length },
    { name: "Maintenance", value: fleet.filter((v) => v.status === "maintenance").length },
    { name: "Idle", value: fleet.filter((v) => v.status === "idle").length },
  ];

  const empty = inv.length + pay.length + fleet.length + prod.length === 0;

  return (
    <div>
      <PageHeader title="Reports" description="Cross-module overview of your SmartOps workspace." />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Inventory value" value={currency(invValue)} icon={HiOutlineCube} />
        <StatCard label="Monthly payroll" value={currency(payrollTotal)} icon={HiOutlineBanknotes} />
        <StatCard label="Vehicles" value={String(fleet.length)} icon={HiOutlineTruck} />
        <StatCard label="Production runs" value={String(prod.length)} icon={HiOutlineWrenchScrewdriver} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="card-3d rounded-2xl p-5 xl:col-span-2">
          <h3 className="font-display text-lg font-bold text-ink">Records by module</h3>
          <p className="text-xs text-muted-foreground">Total entries you have created in each module.</p>
          <div className="mt-4 h-72">
            <ResponsiveContainer>
              <BarChart data={moduleData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid stroke="oklch(0.9 0.01 230)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" stroke="oklch(0.55 0.01 240)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.55 0.01 240)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "white", border: "1px solid oklch(0.9 0.01 230)", borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="count" fill="oklch(0.74 0.13 205)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-3d rounded-2xl p-5">
          <h3 className="font-display text-lg font-bold text-ink">Fleet status</h3>
          <p className="text-xs text-muted-foreground">Distribution across vehicle states.</p>
          <div className="mt-4 h-72">
            {fleet.length === 0 ? (
              <EmptyMini icon={HiOutlineChartBar} text="Add vehicles to see distribution" />
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={fleetStatus} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {fleetStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Legend />
                  <Tooltip contentStyle={{ background: "white", border: "1px solid oklch(0.9 0.01 230)", borderRadius: 12, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {empty && (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface/60 p-6 text-center text-sm text-muted-foreground">
          No data yet. Add records in Inventory, Payroll, Fleet, or Production to populate these reports.
        </div>
      )}
    </div>
  );
}

function EmptyMini({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
      <Icon className="h-8 w-8 text-aqua" />
      <p className="text-sm">{text}</p>
    </div>
  );
}
