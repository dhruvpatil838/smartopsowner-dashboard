import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true },
    role: { type: String, required: true },
    department: { type: String, default: "Operations" },
    salary: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["paid", "pending"], default: "pending" },
    payDate: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("Employee", schema);
