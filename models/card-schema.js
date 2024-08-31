const mongoose = require("mongoose");

const cardSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  ref_type: { type: String, enum: ["User", "PrintAgent"], required: true },
  bank_name: { type: String, required: true },
  card_number: {
    type: String,
    required: true,
    unique: true,
  },
  expiry_date: { type: String, required: true },
  phone_number: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

// Pre-save hook to update the 'updated_at' field
cardSchema.pre("save", function (next) {
  this.updated_at = Date.now();
  next();
});

const Card = mongoose.model("Card", cardSchema);
module.exports = Card;
