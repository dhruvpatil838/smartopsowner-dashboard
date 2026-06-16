import mongoose from "mongoose";

const gpsSchema = new mongoose.Schema(
  {
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    trip: { type: mongoose.Schema.Types.ObjectId, ref: "Trip" },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    speedKph: { type: Number, default: 0 },
    etaMinutes: { type: Number, default: 0 },
    recordedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

export default mongoose.model("GPSLocation", gpsSchema);
