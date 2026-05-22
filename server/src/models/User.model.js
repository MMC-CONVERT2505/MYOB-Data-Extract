import mongoose from "mongoose";

const companyFileSchema = new mongoose.Schema(
  {
    Id:   { type: String },
    Name: { type: String },
    Uri:  { type: String },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    // ── Identity ────────────────────────────────────────────
    // MYOB does not always return a stable user ID in the token.
    // We use accessToken's user info OR myobUserId from token if present.
    // For multi-user: each MYOB account = one User document.
    myobUserId: {
      type: String,
      unique: true,
      sparse: true, // some tokens may not have a user ID
    },

    // ── OAuth Tokens ────────────────────────────────────────
    accessToken:    { type: String, required: true },
    refreshToken:   { type: String, required: true },
    tokenExpiresAt: { type: Number, required: true }, // Unix ms timestamp

    // ── Selected Company ────────────────────────────────────
    businessId:   { type: String, default: null },
    businessName: { type: String, default: null },
    businessUri:  { type: String, default: null },

    // ── All Company Files ────────────────────────────────────
    companyFiles: { type: [companyFileSchema], default: [] },

    // ── Metadata ─────────────────────────────────────────────
    lastLoginAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);


const User = mongoose.model("User", userSchema);

export default User;