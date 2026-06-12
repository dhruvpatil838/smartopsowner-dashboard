import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";
import inventoryRoutes from "./routes/inventory.routes.js";
import payrollRoutes from "./routes/payroll.routes.js";
import fleetRoutes from "./routes/fleet.routes.js";
import productionRoutes from "./routes/production.routes.js";
import reportsRoutes from "./routes/reports.routes.js";
import { errorHandler, notFound } from "./middleware/error.js";

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(",") ?? "*", credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use("/api/", rateLimit({ windowMs: 15 * 60 * 1000, max: 600 }));

app.get("/api/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.use("/api/auth", authRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/fleet", fleetRoutes);
app.use("/api/production", productionRoutes);
app.use("/api/reports", reportsRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
connectDB(process.env.MONGO_URI).then(() => {
  app.listen(PORT, () => console.log(`SmartOps API on :${PORT}`));
});
