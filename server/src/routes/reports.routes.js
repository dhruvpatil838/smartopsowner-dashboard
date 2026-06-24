import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import Inventory from "../models/Inventory.js";
import Employee from "../models/Employee.js";
import Vehicle from "../models/Vehicle.js";
import ProductionRun from "../models/ProductionRun.js";

const r = Router();
r.use(requireAuth, requireRole("owner", "supervisor"));

r.get("/summary", asyncHandler(async (req, res) => {
  const owner = req.user._id;
  const [inv, emp, veh, prod] = await Promise.all([
    Inventory.find({ owner }),
    Employee.find({ owner }),
    Vehicle.find({ owner }),
    ProductionRun.find({ owner }),
  ]);
  const inventoryValue = inv.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const monthlyPayroll = emp.reduce((s, e) => s + e.salary, 0);
  const targetUnits = prod.reduce((s, p) => s + p.target, 0);
  const producedUnits = prod.reduce((s, p) => s + p.produced, 0);
  res.json({
    counts: { inventory: inv.length, employees: emp.length, vehicles: veh.length, runs: prod.length },
    inventoryValue,
    monthlyPayroll,
    efficiency: targetUnits ? Math.round((producedUnits / targetUnits) * 100) : 0,
    fleet: {
      active: veh.filter(v => v.status === "active").length,
      maintenance: veh.filter(v => v.status === "maintenance").length,
      idle: veh.filter(v => v.status === "idle").length,
    },
  });
}));

export default r;
