import mongoose from "mongoose";

const managedTripSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "DriverRecord", index: true },
    driverName: { type: String, required: true },
    tripCode: { type: String, required: true, index: true },
    source: { type: String, required: true },
    destination: { type: String, required: true },
    vehicleNumber: { type: String, default: "" },
    startDate: { type: Date, default: Date.now },
    expectedDelivery: { type: Date },
    actualDelivery: { type: Date },
    status: {
      type: String,
      enum: ["pending", "in_transit", "delivered", "delayed", "cancelled"],
      default: "pending",
      index: true,
    },
    notes: { type: String, default: "" },
    distanceKm: { type: Number, default: 0 },
    priority: { type: String, enum: ["low", "medium", "high", "urgent"], default: "medium" },
    cargoType: { type: String, default: "" },
    weight: { type: Number, default: 0 },
  },
  { timestamps: true }
);

managedTripSchema.index({ owner: 1, status: 1 });
managedTripSchema.index({ owner: 1, driverId: 1 });

export default mongoose.model("ManagedTrip", managedTripSchema);
