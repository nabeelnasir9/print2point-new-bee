const mongoose = require("mongoose");

const announcementBannerSchema = new mongoose.Schema(
  {
    message: { type: String, default: "" },
    enabled: { type: Boolean, default: false },
    showButton1: { type: Boolean, default: false },
    button1Text: { type: String, default: "" },
    button1Link: { type: String, default: "" },
    showButton2: { type: Boolean, default: false },
    button2Text: { type: String, default: "" },
    button2Link: { type: String, default: "" },
  },
  { timestamps: true }
);

const AnnouncementBanner = mongoose.model(
  "AnnouncementBanner",
  announcementBannerSchema
);
module.exports = AnnouncementBanner;
