import mongoose from "mongoose";

const userSettingsSchema = new mongoose.Schema(
  {
    // ── Owner (one settings doc per user) ─────────────────────
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true,
      unique:   true,
    },

    // ── Default extraction preferences ───────────────────────
    defaultOutputFormat: {
      type:    String,
      enum:    ["raw", "qbo", "xero"],
      default: "raw",
    },

    defaultDateRange: {
      type:    String,
      enum:    ["last30", "last60", "last90", "last6months", "lastYear", "custom"],
      default: "last30",
    },

    defaultDataType: {
      type:    String,
      enum:    ["invoices", "bills", "creditNotes", "vendorCredits", "invoicePayments", "billPayments", "banking"],
      default: "invoices",
    },

    defaultSubType: {
      type:    String,
      default: null,
    },

    // ── API Usage Tracking ────────────────────────────────────
    // Tracks how many MYOB API calls this user has made today.
    // Resets automatically when a new day begins (checked in myobService).
    dailyApiLimit: {
      type:    Number,
      default: 500,         // our internal budget per user per day
    },

    dailyApiCount: {
      type:    Number,
      default: 0,           // increments on every myobRequest() call
    },

    lastApiDate: {
      type:    String,
      default: null,        // "YYYY-MM-DD" — used to detect new day and reset counter
    },
  },
  {
    timestamps: true,
  }
);

const UserSettings = mongoose.model("UserSettings", userSettingsSchema);

export default UserSettings;