import mongoose from "mongoose";

const driverSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    employeeId: { type: String, default: "" },
    licenseNumber: { type: String, default: "" },
    vehicleAssigned: { type: String, default: "" },
    joiningDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("Driver", driverSchema);
