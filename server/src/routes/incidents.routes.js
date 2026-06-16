import { Router } from "express";
import { z } from "zod";
import Incident from "../models/Incident.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";

const r = Router();
r.use(requireAuth);

const schema = z.object({
  trip: z.string().optional(),
  type: z.string().min(1).max(80),
  description: z.string().max(2000).optional(),
  location: z.string().max(200).optional(),
  occurredAt: z.string().optional(),
  evidenceBase64: z.string().max(8_000_000).optional(),
  status: z.enum(["open", "in_review", "resolved"]).optional(),
});

r.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await Incident.find({ driver: req.user._id }).sort({ createdAt: -1 });
    res.json(items);
  })
);

r.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = schema.parse(req.body);
    const item = await Incident.create({ ...data, driver: req.user._id });
    res.status(201).json(item);
  })
);

r.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = schema.partial().parse(req.body);
    const item = await Incident.findOneAndUpdate(
      { _id: req.params.id, driver: req.user._id },
      data,
      { new: true }
    );
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json(item);
  })
);

r.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const item = await Incident.findOneAndDelete({ _id: req.params.id, driver: req.user._id });
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true });
  })
);

export default r;
