import { Router } from "express";
import { z } from "zod";
import Vehicle from "../models/Vehicle.js";
import { requireAuth } from "../middleware/auth.js";
import { crudRoutes } from "../utils/crudFactory.js";

const schema = z.object({
  plate: z.string().min(1).max(20),
  model: z.string().min(1).max(120),
  driver: z.string().max(120).default(""),
  status: z.enum(["active", "maintenance", "idle"]).default("idle"),
  mileage: z.number().min(0).default(0),
  lastService: z.string().optional(),
});

const { list, create, update, remove } = crudRoutes(Vehicle, schema);
const r = Router();
r.use(requireAuth);
r.get("/", list);
r.post("/", create);
r.put("/:id", update);
r.delete("/:id", remove);
export default r;
