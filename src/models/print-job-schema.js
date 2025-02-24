const mongoose = require("mongoose");

const printJobSchema = new mongoose.Schema({
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
  print_agent_id: { type: mongoose.Schema.Types.ObjectId, ref: "PrintAgent" },
  file_path: { type: String, required: true },
  print_job_title: { type: String, required: true },
  confirmation_code: { type: String },
  confirmation_code_expiry: {
    type: Date,
    default: "2025-02-24T21:13:00.139Z",
  },
  is_color: { type: Boolean, required: true },
  print_job_description: { type: String },
  no_of_copies: { type: Number, required: true, default: 1 },
  pages: { type: Number, required: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ["pending", "completed"],
    default: "pending",
  },
  payment_status: {
    type: String,
    enum: ["pending", "completed"],
    default: "pending",
  },
  total_cost: { type: Number, required: true },
  agent_payment_status: {
    type: String,
    enum: ["pending", "completed"],
    default: "pending",
    required: true,
  },
});

// Pre-save hook to update the 'updated_at' field
printJobSchema.pre("save", function (next) {
  this.updated_at = Date.now();
  next();
});

const PrintJob = mongoose.model("PrintJob", printJobSchema);

module.exports = PrintJob;
