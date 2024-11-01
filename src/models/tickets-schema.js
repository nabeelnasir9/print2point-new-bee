const mongoose = require("mongoose");

const ticketsSchema = new mongoose.Schema({
  full_name: { type: String, required: true },
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
  email: { type: String, required: true },
  order_number: { type: String, required: true },
  message: { type: String, required: true },
  status: {
    type: String,
    enum: ["pending", "completed"],
    default: "pending",
  },
  bank: {
    bank_name: { type: String },
    bank_number: { type: String },
    full_name_bank: { type: String },
  },
});

const Tickets = mongoose.model("Tickets", ticketsSchema);

module.exports = Tickets;
