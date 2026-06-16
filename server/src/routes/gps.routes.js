import { Router } from "express";
import { z } from "zod";
import GPSLocation from "../models/GPSLocation.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";

const r = Router();
r.use(requireAuth);

const schema = z.object({
  trip: z.string().optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  speedKph: z.number().min(0).max(400).optional(),
  etaMinutes: z.number().min(0).max(100000).optional(),
});

r.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const items = await GPSLocation.find({ driver: req.user._id })
      .sort({ recordedAt: -1 })
      .limit(limit);
    res.json(items);
  })
);

r.get(
  "/current",
  asyncHandler(async (req, res) => {
    const item = await GPSLocation.findOne({ driver: req.user._id }).sort({ recordedAt: -1 });
    res.json(item || null);
  })
);

r.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = schema.parse(req.body);
    const item = await GPSLocation.create({
      ...data,
      driver: req.user._id,
      recordedAt: new Date(),
    });
    res.status(201).json(item);
  })
);

export default r;
