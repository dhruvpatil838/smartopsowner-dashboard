import { Router } from "express";
import { z } from "zod";
import Inventory from "../models/Inventory.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { crudRoutes } from "../utils/crudFactory.js";

const schema = z.object({
  sku: z.string().min(1).max(60),
  name: z.string().min(1).max(160),
  category: z.string().max(80).optional().default(""),
  quantity: z.number().min(0).default(0),
  unitPrice: z.number().min(0).default(0),
  reorderLevel: z.number().min(0).default(5),
});

const { list, create, update, remove } = crudRoutes(Inventory, schema);
const r = Router();
r.use(requireAuth);
r.get("/", list);
r.post("/", create);
r.put("/:id", update);
r.delete("/:id", remove);
export default r;
