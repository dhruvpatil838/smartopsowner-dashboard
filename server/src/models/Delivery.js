import mongoose from "mongoose";

const deliverySchema = new mongoose.Schema(
  {
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    trip: { type: mongoose.Schema.Types.ObjectId, ref: "Trip" },
    customerName: { type: String, default: "" },
    address: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "picked_up", "in_transit", "arrived", "delivered", "delayed", "cancelled"],
      default: "pending",
    },
    photoBase64: { type: String, default: "" },
    signatureBase64: { type: String, default: "" },
    notes: { type: String, default: "" },
    deliveredAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("Delivery", deliverySchema);
