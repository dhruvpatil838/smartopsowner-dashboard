import { Router } from "express";
import { z } from "zod";
import Trip from "../models/Trip.js";
import Notification from "../models/Notification.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";

const r = Router();
r.use(requireAuth);

const createSchema = z.object({
  tripCode: z.string().min(1).max(40),
  source: z.string().min(1).max(200),
  destination: z.string().min(1).max(200),
  vehicleNumber: z.string().max(40).optional().default(""),
  startDate: z.string().optional(),
  expectedDelivery: z.string().optional(),
  status: z.enum(["pending", "in_transit", "delivered", "delayed", "cancelled"]).optional(),
  notes: z.string().max(2000).optional(),
  distanceKm: z.number().min(0).optional(),
});

r.get(
  "/",
  asyncHandler(async (req, res) => {
    const trips = await Trip.find({ driver: req.user._id }).sort({ createdAt: -1 });
    res.json(trips);
  })
);

r.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const trip = await Trip.create({ ...data, driver: req.user._id });
    await Notification.create({
      driver: req.user._id,
      type: "trip_assigned",
      title: `New trip ${trip.tripCode}`,
      message: `${trip.source} → ${trip.destination}`,
    });
    res.status(201).json(trip);
  })
);

r.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const trip = await Trip.findOne({ _id: req.params.id, driver: req.user._id });
    if (!trip) return res.status(404).json({ message: "Not found" });
    res.json(trip);
  })
);

r.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = createSchema.partial().parse(req.body);
    const trip = await Trip.findOneAndUpdate(
      { _id: req.params.id, driver: req.user._id },
      data,
      { new: true }
    );
    if (!trip) return res.status(404).json({ message: "Not found" });
    res.json(trip);
  })
);

r.post(
  "/:id/status",
  asyncHandler(async (req, res) => {
    const { status } = z
      .object({ status: z.enum(["pending", "in_transit", "delivered", "delayed", "cancelled"]) })
      .parse(req.body);
    const trip = await Trip.findOneAndUpdate(
      { _id: req.params.id, driver: req.user._id },
      { status },
      { new: true }
    );
    if (!trip) return res.status(404).json({ message: "Not found" });
    if (status === "delivered") {
      await Notification.create({
        driver: req.user._id,
        type: "delivery_completed",
        title: `Trip ${trip.tripCode} delivered`,
        message: `${trip.destination} marked delivered.`,
      });
    } else if (status === "delayed") {
      await Notification.create({
        driver: req.user._id,
        type: "delivery_delayed",
        title: `Trip ${trip.tripCode} delayed`,
        message: `Route ${trip.source} → ${trip.destination}`,
      });
    }
    res.json(trip);
  })
);

r.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const trip = await Trip.findOneAndDelete({ _id: req.params.id, driver: req.user._id });
    if (!trip) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true });
  })
);

export default r;
