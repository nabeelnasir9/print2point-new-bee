const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  customer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  printAgent_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "PrintAgent",
    required: true,
  },
  document_url: { type: String, required: true },
  page_count: { type: Number, required: true },
  cost: { type: Number, required: true },
  status: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  completed_at: { type: Date },
  confirmation_code: { type: String },
});

// Pre-save hook to update the 'updatedAt' field
orderSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
