import { Router } from "express";
import { z } from "zod";
import ManagedTrip from "../models/ManagedTrip.js";
import DriverRecord from "../models/DriverRecord.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";

const r = Router();
r.use(requireAuth);

const tripSchema = z.object({
  driverId: z.string().optional(),
  driverName: z.string().min(1).max(160),
  tripCode: z.string().min(1).max(40),
  source: z.string().min(1).max(200),
  destination: z.string().min(1).max(200),
  vehicleNumber: z.string().max(40).optional().default(""),
  startDate: z.string().optional(),
  expectedDelivery: z.string().optional(),
  status: z.enum(["pending", "in_transit", "delivered", "delayed", "cancelled"]).optional(),
  notes: z.string().max(2000).optional(),
  distanceKm: z.number().min(0).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  cargoType: z.string().max(100).optional(),
  weight: z.number().min(0).optional(),
});

// GET /api/managed-trips - List all trips with filters
r.get(
  "/",
  asyncHandler(async (req, res) => {
    const { status, driverId, search, priority, startDate, endDate } = req.query;

    const filter = { owner: req.user._id };

    if (status && ["pending", "in_transit", "delivered", "delayed", "cancelled"].includes(status)) {
      filter.status = status;
    }

    if (driverId) {
      filter.driverId = driverId;
    }

    if (priority && ["low", "medium", "high", "urgent"].includes(priority)) {
      filter.priority = priority;
    }

    if (typeof search === "string" && search.trim()) {
      const term = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { tripCode: { $regex: term, $options: "i" } },
        { driverName: { $regex: term, $options: "i" } },
        { source: { $regex: term, $options: "i" } },
        { destination: { $regex: term, $options: "i" } },
      ];
    }

    if (startDate || endDate) {
      filter.startDate = {};
      if (startDate) filter.startDate.$gte = new Date(startDate);
      if (endDate) filter.startDate.$lte = new Date(endDate);
    }

    const trips = await ManagedTrip.find(filter)
      .sort({ createdAt: -1 })
      .populate("driverId", "name phone status vehicleAssigned")
      .lean();

    res.json(trips);
  })
);

// GET /api/managed-trips/stats - Dashboard statistics
r.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const ownerId = req.user._id;

    const [totalTrips, pendingTrips, inTransitTrips, deliveredTrips, delayedTrips, totalDrivers, activeDrivers] =
      await Promise.all([
        ManagedTrip.countDocuments({ owner: ownerId }),
        ManagedTrip.countDocuments({ owner: ownerId, status: "pending" }),
        ManagedTrip.countDocuments({ owner: ownerId, status: "in_transit" }),
        ManagedTrip.countDocuments({ owner: ownerId, status: "delivered" }),
        ManagedTrip.countDocuments({ owner: ownerId, status: "delayed" }),
        DriverRecord.countDocuments({ owner: ownerId }),
        DriverRecord.countDocuments({ owner: ownerId, status: "active" }),
      ]);

    // Get this week's trips
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weeklyTrips = await ManagedTrip.countDocuments({
      owner: ownerId,
      createdAt: { $gte: oneWeekAgo },
    });

    // Get average trips per driver
    const avgTripsPerDriver = totalDrivers > 0 ? Math.round((totalTrips / totalDrivers) * 10) / 10 : 0;

    // Get total distance
    const distanceResult = await ManagedTrip.aggregate([
      { $match: { owner: ownerId._id } },
      { $group: { _id: null, totalDistance: { $sum: "$distanceKm" } } },
    ]);
    const totalDistance = distanceResult[0]?.totalDistance || 0;

    res.json({
      totalTrips,
      pendingTrips,
      inTransitTrips,
      deliveredTrips,
      delayedTrips,
      totalDrivers,
      activeDrivers,
      weeklyTrips,
      avgTripsPerDriver,
      totalDistance,
    });
  })
);

// GET /api/managed-trips/:id
r.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const trip = await ManagedTrip.findOne({
      _id: req.params.id,
      owner: req.user._id,
    })
      .populate("driverId", "name phone status vehicleAssigned licenseNumber")
      .lean();

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    res.json(trip);
  })
);

// POST /api/managed-trips - Create new trip
r.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = tripSchema.parse(req.body);

    // Verify driver belongs to this owner if driverId provided
    if (data.driverId) {
      const driver = await DriverRecord.findOne({
        _id: data.driverId,
        owner: req.user._id,
      });
      if (!driver) {
        return res.status(400).json({ message: "Driver not found" });
      }
      // Update driver name from record
      data.driverName = driver.name;
    }

    const trip = await ManagedTrip.create({
      ...data,
      owner: req.user._id,
    });

    // Update driver's tripsCompleted counter if assigned
    if (data.driverId) {
      await DriverRecord.findByIdAndUpdate(data.driverId, {
        $inc: { tripsCompleted: 1 },
      });
    }

    res.status(201).json(trip);
  })
);

// PUT /api/managed-trips/:id - Update trip
r.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = tripSchema.partial().parse(req.body);

    // If changing driver, verify new driver
    if (data.driverId) {
      const driver = await DriverRecord.findOne({
        _id: data.driverId,
        owner: req.user._id,
      });
      if (!driver) {
        return res.status(400).json({ message: "Driver not found" });
      }
      data.driverName = driver.name;
    }

    const trip = await ManagedTrip.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      data,
      { new: true }
    ).populate("driverId", "name phone status vehicleAssigned");

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    res.json(trip);
  })
);

// PUT /api/managed-trips/:id/status - Update trip status
r.put(
  "/:id/status",
  asyncHandler(async (req, res) => {
    const { status } = z
      .object({ status: z.enum(["pending", "in_transit", "delivered", "delayed", "cancelled"]) })
      .parse(req.body);

    const updateData = { status };

    if (status === "delivered") {
      updateData.actualDelivery = new Date();
    }

    const trip = await ManagedTrip.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      updateData,
      { new: true }
    ).populate("driverId", "name phone status vehicleAssigned");

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    res.json(trip);
  })
);

// PUT /api/managed-trips/:id/assign - Assign driver to trip
r.put(
  "/:id/assign",
  asyncHandler(async (req, res) => {
    const { driverId } = z.object({ driverId: z.string() }).parse(req.body);

    const driver = await DriverRecord.findOne({
      _id: driverId,
      owner: req.user._id,
    });

    if (!driver) {
      return res.status(400).json({ message: "Driver not found" });
    }

    const trip = await ManagedTrip.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      { driverId: driver._id, driverName: driver.name, vehicleNumber: driver.vehicleAssigned || "" },
      { new: true }
    ).populate("driverId", "name phone status vehicleAssigned");

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    // Increment driver's trip count
    await DriverRecord.findByIdAndUpdate(driverId, { $inc: { tripsCompleted: 1 } });

    res.json(trip);
  })
);

// DELETE /api/managed-trips/:id
r.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const trip = await ManagedTrip.findOneAndDelete({
      _id: req.params.id,
      owner: req.user._id,
    });

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    // Decrement driver's trip count if assigned
    if (trip.driverId) {
      await DriverRecord.findByIdAndUpdate(trip.driverId, {
        $dec: { tripsCompleted: 1 },
      });
    }

    res.json({ ok: true });
  })
);

export default r;
