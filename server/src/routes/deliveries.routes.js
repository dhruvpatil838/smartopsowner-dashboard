import { Router } from "express";
import { z } from "zod";
import Delivery from "../models/Delivery.js";
import Notification from "../models/Notification.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";

const r = Router();
r.use(requireAuth);

const STATUS = ["pending", "picked_up", "in_transit", "arrived", "delivered", "delayed", "cancelled"];

const schema = z.object({
  trip: z.string().optional(),
  customerName: z.string().max(160).optional(),
  address: z.string().max(400).optional(),
  status: z.enum(STATUS).optional(),
  photoBase64: z.string().max(8_000_000).optional(),
  signatureBase64: z.string().max(2_000_000).optional(),
  notes: z.string().max(2000).optional(),
  deliveredAt: z.string().optional(),
});

r.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await Delivery.find({ driver: req.user._id }).sort({ createdAt: -1 });
    res.json(items);
  })
);

r.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = schema.parse(req.body);
    const item = await Delivery.create({ ...data, driver: req.user._id });
    res.status(201).json(item);
  })
);

r.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = schema.partial().parse(req.body);
    const item = await Delivery.findOneAndUpdate(
      { _id: req.params.id, driver: req.user._id },
      data,
      { new: true }
    );
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json(item);
  })
);

r.post(
  "/:id/confirm",
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        photoBase64: z.string().optional(),
        signatureBase64: z.string().optional(),
        notes: z.string().max(2000).optional(),
      })
      .parse(req.body);
    const item = await Delivery.findOneAndUpdate(
      { _id: req.params.id, driver: req.user._id },
      { ...data, status: "delivered", deliveredAt: new Date() },
      { new: true }
    );
    if (!item) return res.status(404).json({ message: "Not found" });
    await Notification.create({
      driver: req.user._id,
      type: "delivery_completed",
      title: "Delivery confirmed",
      message: `Delivery to ${item.customerName || "customer"} confirmed with POD.`,
    });
    res.json(item);
  })
);

r.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const item = await Delivery.findOneAndDelete({ _id: req.params.id, driver: req.user._id });
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true });
  })
);

export default r;
