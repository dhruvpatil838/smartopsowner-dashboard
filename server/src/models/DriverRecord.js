import mongoose from "mongoose";

const driverRecordSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    licenseNumber: { type: String, required: true, trim: true },
    vehicleAssigned: { type: String, default: "", trim: true },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    tripsCompleted: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

driverRecordSchema.index({ owner: 1, name: 1 });

export default mongoose.model("DriverRecord", driverRecordSchema);
