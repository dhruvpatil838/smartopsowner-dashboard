import { Router } from "express";
import {
  register, login, me, updateProfile, changePassword,
  forgotPassword, resetPassword, logout,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";

const r = Router();
r.post("/register", register);
r.post("/login", login);
r.post("/forgot-password", forgotPassword);
r.post("/reset-password", resetPassword);
r.get("/profile", requireAuth, me);
r.put("/profile", requireAuth, updateProfile);
r.put("/change-password", requireAuth, changePassword);
r.post("/logout", requireAuth, logout);
export default r;
