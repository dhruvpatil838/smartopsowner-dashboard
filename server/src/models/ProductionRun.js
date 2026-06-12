import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    product: { type: String, required: true },
    line: { type: String, default: "Line A" },
    target: { type: Number, default: 0, min: 0 },
    produced: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["planned", "running", "completed"], default: "planned" },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("ProductionRun", schema);
