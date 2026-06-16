import mongoose from "mongoose";

const incidentSchema = new mongoose.Schema(
  {
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    trip: { type: mongoose.Schema.Types.ObjectId, ref: "Trip" },
    type: { type: String, required: true },
    description: { type: String, default: "" },
    location: { type: String, default: "" },
    occurredAt: { type: Date, default: Date.now },
    evidenceBase64: { type: String, default: "" },
    status: { type: String, enum: ["open", "in_review", "resolved"], default: "open" },
  },
  { timestamps: true }
);

export default mongoose.model("Incident", incidentSchema);
