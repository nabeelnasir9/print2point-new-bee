const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const printAgentSchema = new mongoose.Schema({
  full_name: { type: String, required: true },
  email: { type: String, required: true, unique: true, match: /.+\@.+\..+/ },
  password: { type: String, required: true, minlength: 6 },
  business_name: { type: String, required: true },
  business_type: { type: String, required: true },
  personal_info: { type: String },
  personal_phone_number: {
    type: String,
    match: /^\+[0-9]{2,3}\d{9,10}$/,
  },
  location: {
    address: { type: String },
    city: { type: String },
    state: { type: String },
    zip_code: { type: String },
    country: { type: String },
    coordinates: {
      longtitude: { type: Number },
      latitude: { type: Number },
    },
  },
  cards: [{ type: mongoose.Schema.Types.ObjectId, ref: "Card" }],
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
printAgentSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.otp;
    delete ret.otp_expiry;
    return ret;
  },
});
const PrintAgent = mongoose.model("PrintAgent", printAgentSchema);
module.exports = PrintAgent;
