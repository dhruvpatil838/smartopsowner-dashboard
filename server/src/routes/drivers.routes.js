import { Router } from "express";
import { z } from "zod";
import Driver from "../models/Driver.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";

const r = Router();
r.use(requireAuth);

const schema = z.object({
  employeeId: z.string().max(60).optional(),
  licenseNumber: z.string().max(60).optional(),
  vehicleAssigned: z.string().max(60).optional(),
  joiningDate: z.string().optional(),
});

// Get my driver profile (auto-create on first read)
r.get(
  "/me",
  asyncHandler(async (req, res) => {
    let d = await Driver.findOne({ user: req.user._id });
    if (!d) d = await Driver.create({ user: req.user._id });
    res.json({
      driver: d,
      user: req.user.toSafeJSON(),
    });
  })
);

r.put(
  "/me",
  asyncHandler(async (req, res) => {
    const data = schema.parse(req.body);
    const d = await Driver.findOneAndUpdate(
      { user: req.user._id },
      { ...data, user: req.user._id },
      { new: true, upsert: true }
    );
    res.json({ driver: d });
  })
);

export default r;
