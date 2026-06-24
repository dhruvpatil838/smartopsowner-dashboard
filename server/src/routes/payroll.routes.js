import { Router } from "express";
import { z } from "zod";
import Employee from "../models/Employee.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { crudRoutes } from "../utils/crudFactory.js";

const schema = z.object({
  name: z.string().min(1).max(160),
  role: z.string().min(1).max(120),
  department: z.string().max(80).default("Operations"),
  salary: z.number().min(0).default(0),
  status: z.enum(["paid", "pending"]).default("pending"),
  payDate: z.string().datetime().optional(),
});

const { list, create, update, remove } = crudRoutes(Employee, schema);
const r = Router();
r.use(requireAuth, requireRole("owner", "supervisor"));
r.get("/", list);
r.post("/", create);
r.put("/:id", update);
r.delete("/:id", remove);
export default r;
