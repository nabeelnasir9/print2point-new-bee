const express = require("express");
const verifyToken = require("../middleware/verifyToken.js");
const {
  registerNotificationToken,
  unregisterNotificationToken,
} = require("../utils/pushNotifications.js");

const router = express.Router();

// POST /api/notifications/register-token
// Body: { device_token, platform? }
// Works for both customers and print agents (role comes from JWT)
router.post("/register-token", verifyToken(), async (req, res) => {
  try {
    const { device_token, platform } = req.body;

    if (!device_token) {
      return res.status(400).json({ message: "device_token is required" });
    }

    // req.user.role is "customer" or "printAgent" (set by verifyToken)
    const userType = req.user.role;
    if (userType !== "customer" && userType !== "printAgent") {
      return res
        .status(400)
        .json({ message: "Notifications are only available for app users" });
    }

    const token = await registerNotificationToken(
      req.user.id,
      userType,
      device_token,
      platform || "mobile",
    );

    res.status(200).json({
      message: "Notification token registered successfully",
      token_id: token._id,
    });
  } catch (err) {
    console.error("Error registering notification token:", err.message);
    res.status(500).json({ message: "Server error", err: err.message });
  }
});

// POST /api/notifications/unregister-token
// Body: { device_token }  — call on logout
router.post("/unregister-token", verifyToken(), async (req, res) => {
  try {
    const { device_token } = req.body;

    if (!device_token) {
      return res.status(400).json({ message: "device_token is required" });
    }

    await unregisterNotificationToken(device_token);

    res
      .status(200)
      .json({ message: "Notification token unregistered successfully" });
  } catch (err) {
    console.error("Error unregistering notification token:", err.message);
    res.status(500).json({ message: "Server error", err: err.message });
  }
});

module.exports = router;
