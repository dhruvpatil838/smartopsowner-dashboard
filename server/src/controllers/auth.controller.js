import { z } from "zod";
import User from "../models/User.js";
import { asyncHandler } from "../middleware/error.js";
import { signToken, generateResetCode, hashCode } from "../utils/token.js";

const registerSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(6).max(200),
  company: z.string().max(200).optional(),
  role: z.enum(["owner", "manager", "worker"]).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const register = asyncHandler(async (req, res) => {
  const data = registerSchema.parse(req.body);
  const exists = await User.findOne({ email: data.email });
  if (exists) return res.status(409).json({ message: "Email already registered" });
  const user = await User.create(data);
  const token = signToken(user._id);
  res.status(201).json({ token, user: user.toSafeJSON() });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ message: "Invalid credentials" });
  }
  const token = signToken(user._id);
  res.json({ token, user: user.toSafeJSON() });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user.toSafeJSON() });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const schema = z.object({
    name: z.string().min(1).max(120).optional(),
    company: z.string().max(200).optional(),
    phone: z.string().max(40).optional(),
    avatar: z.string().max(500_000).optional(),
  });
  const data = schema.parse(req.body);
  Object.assign(req.user, data);
  await req.user.save();
  res.json({ user: req.user.toSafeJSON() });
});

export const changePassword = asyncHandler(async (req, res) => {
  const schema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(6).max(200),
  });
  const { currentPassword, newPassword } = schema.parse(req.body);
  const user = await User.findById(req.user._id).select("+password");
  if (!(await user.comparePassword(currentPassword))) {
    return res.status(400).json({ message: "Current password is incorrect" });
  }
  user.password = newPassword;
  await user.save();
  res.json({ ok: true });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = z.object({ email: z.string().email() }).parse(req.body);
  const user = await User.findOne({ email });
  // Always 200 to avoid email enumeration
  if (!user) return res.json({ ok: true });
  const code = generateResetCode();
  user.resetCodeHash = hashCode(code);
  user.resetCodeExpires = new Date(Date.now() + 15 * 60 * 1000);
  await user.save();
  // In production: email this code. For dev, return it.
  res.json({ ok: true, devCode: process.env.NODE_ENV === "production" ? undefined : code });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    code: z.string().min(4).max(10),
    newPassword: z.string().min(6).max(200),
  });
  const { email, code, newPassword } = schema.parse(req.body);
  const user = await User.findOne({ email }).select("+resetCodeHash +resetCodeExpires +password");
  if (!user || !user.resetCodeHash || !user.resetCodeExpires) {
    return res.status(400).json({ message: "Invalid or expired code" });
  }
  if (user.resetCodeExpires < new Date() || user.resetCodeHash !== hashCode(code)) {
    return res.status(400).json({ message: "Invalid or expired code" });
  }
  user.password = newPassword;
  user.resetCodeHash = undefined;
  user.resetCodeExpires = undefined;
  await user.save();
  res.json({ ok: true });
});

export const logout = asyncHandler(async (_req, res) => {
  // JWT is stateless; client just drops the token.
  res.json({ ok: true });
});
