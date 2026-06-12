import jwt from "jsonwebtoken";
import crypto from "crypto";

export function signToken(userId) {
  return jwt.sign({ sub: userId.toString() }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

export function generateResetCode() {
  // 6-digit numeric code
  return ("" + Math.floor(100000 + Math.random() * 900000));
}

export function hashCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}
