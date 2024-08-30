const mongoose = require("mongoose");

const cardSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, required: true }, // Reference to User or PrintAgent
  ref_type: { type: String, enum: ["User", "PrintAgent"], required: true }, // Distinguish between references
  card_number: { type: String, required: true },
  expiry_date: { type: String, required: true },
  card_holder_name: { type: String, required: true },
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
