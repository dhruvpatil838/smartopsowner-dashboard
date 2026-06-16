import mongoose from "mongoose";

const tripSchema = new mongoose.Schema(
  {
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tripCode: { type: String, required: true },
    source: { type: String, required: true },
    destination: { type: String, required: true },
    vehicleNumber: { type: String, default: "" },
    startDate: { type: Date, default: Date.now },
    expectedDelivery: { type: Date },
    status: {
      type: String,
      enum: ["pending", "in_transit", "delivered", "delayed", "cancelled"],
      default: "pending",
    },
    notes: { type: String, default: "" },
    distanceKm: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("Trip", tripSchema);
