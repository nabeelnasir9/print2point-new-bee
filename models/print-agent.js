const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const printAgentSchema = new mongoose.Schema({
  full_name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  business_name: { type: String, required: true },
  business_type: { type: String, required: true },
  // phone_number: { type: String, required: true },
  location: {
    address: { type: String },
    city: { type: String },
    state: { type: String },
    zip_code: { type: String },
    country: { type: String }, // Optional
  },
  card: { type: mongoose.Schema.Types.ObjectId, ref: "Card" },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  verified_email: { type: Boolean, default: false },
  otp: { type: String },
  otp_expiry: { type: Date },
  is_available: { type: Boolean, default: false },
  // INFO: Could be removed and only use the toggle online offline with (is_available) for this.
  // hours_of_operation: [
  //   {
  //     day: { type: String, required: true },
  //     open: { type: String, required: true },
  //     close: { type: String, required: true },
  //   },
  // ],
});

printAgentSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    this.password = await bcrypt.hash(this.password, 8);
    next();
  } catch (err) {
    next(err);
  }
});

printAgentSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const PrintAgent = mongoose.model("PrintAgent", printAgentSchema);
module.exports = PrintAgent;
