const mongoose = require("mongoose");

const notificationTokenSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: "user_type_ref",
  },
  user_type: {
    type: String,
    enum: ["customer", "printAgent"],
    required: true,
  },
  device_token: {
    type: String,
    required: true,
    unique: true,
  },
  platform: {
    type: String,
    enum: ["ios", "android", "mobile", "web"],
    default: "mobile",
  },
  is_active: {
    type: Boolean,
    default: true,
  },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

// Map user_type to the correct model for refPath population
notificationTokenSchema.virtual("user_type_ref").get(function () {
  return this.user_type === "printAgent" ? "PrintAgent" : "Customer";
});

notificationTokenSchema.index({ user_id: 1, user_type: 1, is_active: 1 });

notificationTokenSchema.pre("save", function (next) {
  this.updated_at = Date.now();
  next();
});

const NotificationToken = mongoose.model(
  "NotificationToken",
  notificationTokenSchema,
);

module.exports = NotificationToken;
