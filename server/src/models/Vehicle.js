import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    plate: { type: String, required: true },
    model: { type: String, required: true },
    driver: { type: String, default: "" },
    status: { type: String, enum: ["active", "maintenance", "idle"], default: "idle" },
    mileage: { type: Number, default: 0, min: 0 },
    lastService: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("Vehicle", schema);
