import { Router } from "express";
import { z } from "zod";
import DriverRecord from "../models/DriverRecord.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";

const r = Router();
r.use(requireAuth);

const bodySchema = z.object({
  name: z.string().min(1).max(160),
  phone: z.string().min(1).max(40),
  licenseNumber: z.string().min(1).max(60),
  vehicleAssigned: z.string().max(120).optional().default(""),
  status: z.enum(["active", "inactive"]).optional(),
  tripsCompleted: z.number().min(0).optional(),
});

// GET /api/driver-management?search=&status=
r.get(
  "/",
  asyncHandler(async (req, res) => {
    const { search, status } = req.query;

    const filter = { owner: req.user._id };
    if (status === "active" || status === "inactive") filter.status = status;

    if (typeof search === "string" && search.trim()) {
      const term = search.trim();
      // $expr lets us OR across fields safely (with proper escaping via $concat fails on regex,
      // so we use a $or of case-insensitive regexes on each searchable field).
      const safe = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { name: { $regex: safe, $options: "i" } },
        { phone: { $regex: safe, $options: "i" } },
        { licenseNumber: { $regex: safe, $options: "i" } },
      ];
    }

    const items = await DriverRecord.find(filter).sort({ createdAt: -1 }).lean();
    res.json(items);
  }),
);

// GET /api/driver-management/:id
r.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const item = await DriverRecord.findOne({ _id: req.params.id, owner: req.user._id }).lean();
    if (!item) return res.status(404).json({ message: "Driver not found" });
    res.json(item);
  }),
);

// POST /api/driver-management
r.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = bodySchema.parse(req.body);
    const item = await DriverRecord.create({ ...data, owner: req.user._id });
    res.status(201).json(item);
  }),
);

// PUT /api/driver-management/:id
r.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = bodySchema.partial().parse(req.body);
    const item = await DriverRecord.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      data,
      { new: true },
    ).lean();
    if (!item) return res.status(404).json({ message: "Driver not found" });
    res.json(item);
  }),
);

// DELETE /api/driver-management/:id
r.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const item = await DriverRecord.findOneAndDelete({
      _id: req.params.id,
      owner: req.user._id,
    });
    if (!item) return res.status(404).json({ message: "Driver not found" });
    res.json({ ok: true });
  }),
);

export default r;
