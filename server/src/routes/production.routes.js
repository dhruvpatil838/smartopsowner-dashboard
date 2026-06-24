import { Router } from "express";
import { z } from "zod";
import ProductionRun from "../models/ProductionRun.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { crudRoutes } from "../utils/crudFactory.js";

const schema = z.object({
  product: z.string().min(1).max(160),
  line: z.string().default("Line A"),
  target: z.number().min(0).default(0),
  produced: z.number().min(0).default(0),
  status: z.enum(["planned", "running", "completed"]).default("planned"),
  date: z.string().optional(),
});

const { list, create, update, remove } = crudRoutes(ProductionRun, schema);
const r = Router();
r.use(requireAuth);
r.get("/", list);
r.post("/", create);
r.put("/:id", update);
r.delete("/:id", remove);
export default r;
