import { Router } from "express";
import { z } from "zod";
import Notification from "../models/Notification.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";

const r = Router();
r.use(requireAuth);

r.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await Notification.find({ driver: req.user._id })
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(items);
  })
);

r.post(
  "/:id/read",
  asyncHandler(async (req, res) => {
    const item = await Notification.findOneAndUpdate(
      { _id: req.params.id, driver: req.user._id },
      { read: true },
      { new: true }
    );
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json(item);
  })
);

r.post(
  "/read-all",
  asyncHandler(async (_req, res) => {
    await Notification.updateMany({ driver: _req.user._id, read: false }, { read: true });
    res.json({ ok: true });
  })
);

r.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const item = await Notification.findOneAndDelete({
      _id: req.params.id,
      driver: req.user._id,
    });
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true });
  })
);

// Create (used internally; exposed for demo/testing)
r.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        type: z.enum([
          "trip_assigned",
          "delivery_delayed",
          "route_change",
          "delivery_completed",
          "system",
        ]),
        title: z.string().min(1).max(200),
        message: z.string().max(2000).optional(),
      })
      .parse(req.body);
    const item = await Notification.create({ ...data, driver: req.user._id });
    res.status(201).json(item);
  })
);

export default r;
