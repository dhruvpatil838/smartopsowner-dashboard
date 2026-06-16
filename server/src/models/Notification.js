import mongoose from "mongoose";

const notifSchema = new mongoose.Schema(
  {
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: ["trip_assigned", "delivery_delayed", "route_change", "delivery_completed", "system"],
      default: "system",
    },
    title: { type: String, required: true },
    message: { type: String, default: "" },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Notification", notifSchema);
