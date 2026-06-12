import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ["owner", "manager", "worker"], default: "owner" },
    company: { type: String, default: "" },
    phone: { type: String, default: "" },
    avatar: { type: String, default: "" },
    resetCodeHash: { type: String, select: false },
    resetCodeExpires: { type: Date, select: false },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeJSON = function () {
  const { _id, name, email, role, company, phone, avatar, createdAt } = this;
  return { id: _id, name, email, role, company, phone, avatar, createdAt };
};

export default mongoose.model("User", userSchema);
