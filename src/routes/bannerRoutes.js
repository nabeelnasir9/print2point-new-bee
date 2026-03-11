const express = require("express");
const AnnouncementBanner = require("../models/announcement-banner-schema");
const router = express.Router();

// Public: get current banner config (no auth)
router.get("/", async (_req, res) => {
  try {
    let banner = await AnnouncementBanner.findOne();
    if (!banner) {
      banner = await AnnouncementBanner.create({
        message: "",
        enabled: false,
        showButton1: false,
        button1Text: "",
        button1Link: "",
        showButton2: false,
        button2Text: "",
        button2Link: "",
      });
    }
    res.status(200).json({
      message: "Banner fetched successfully",
      banner: {
        message: banner.message,
        enabled: banner.enabled,
        showButton1: banner.showButton1,
        button1Text: banner.button1Text,
        button1Link: banner.button1Link,
        showButton2: banner.showButton2,
        button2Text: banner.button2Text,
        button2Link: banner.button2Link,
      },
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error", err });
  }
});

module.exports = router;
