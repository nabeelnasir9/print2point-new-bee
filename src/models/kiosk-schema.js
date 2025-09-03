const mongoose = require("mongoose");

const kioskSchema = new mongoose.Schema({
  print_agent_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "PrintAgent",
    required: true,
    unique: true
  },
  is_enabled: {
    type: Boolean,
    default: false
  },
  confirmation_code: {
    type: String,
    length: 6
  },
  code_expiry: {
    type: Date
  },
  last_toggle_at: {
    type: Date,
    default: Date.now
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
kioskSchema.pre("save", function (next) {
  this.updated_at = Date.now();
  next();
});

// Index for faster queries
kioskSchema.index({ print_agent_id: 1 });
kioskSchema.index({ confirmation_code: 1 });

const Kiosk = mongoose.model("Kiosk", kioskSchema);
module.exports = Kiosk;