import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sku: { type: String, required: true },
    name: { type: String, required: true },
    category: { type: String, default: "" },
    quantity: { type: Number, default: 0, min: 0 },
    unitPrice: { type: Number, default: 0, min: 0 },
    reorderLevel: { type: Number, default: 5, min: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("InventoryItem", schema);
