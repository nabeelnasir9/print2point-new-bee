const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const customerSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, match: /.+\@.+\..+/ },
  password: { type: String, required: true, minlength: 6 },
  cards: [{ type: mongoose.Schema.Types.ObjectId, ref: "Card" }],
  password: { type: String, required: true, minlength: 6 },
  location: {
    address: { type: String },
    city: { type: String },
    state: { type: String },
    zip_code: { type: String },
    country: { type: String },
  },
  otp: { type: String },
  otp_expiry: { type: Date },
  verified_email: { type: Boolean, default: false },
  phone_number: { type: String },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

// Middleware to hash the password if modified
customerSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    this.password = await bcrypt.hash(this.password, 8);
    next();
  } catch (err) {
    next(err);
  }
});

// Middleware to update the updated_at field
customerSchema.pre("save", function (next) {
  this.updated_at = Date.now();
  next();
});

const Customer = mongoose.model("Customer", customerSchema);
module.exports = Customer;
