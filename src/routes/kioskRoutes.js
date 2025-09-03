const express = require("express");
const verifyToken = require("../middleware/verifyToken.js");
const {
  toggleKioskMode,
  verifyConfirmationCode,
  getKioskStatus
} = require("../controllers/kioskController.js");
const { body, validationResult } = require("express-validator");

const router = express.Router();

// Validation middleware for toggle kiosk mode
const validateToggleKiosk = [
  body("enable")
    .isBoolean()
    .withMessage("Enable field must be a boolean value")
];

// Validation middleware for verification code
const validateConfirmationCode = [
  body("confirmation_code")
    .isLength({ min: 6, max: 6 })
    .withMessage("Confirmation code must be exactly 6 characters")
    .isNumeric()
    .withMessage("Confirmation code must contain only numbers")
];

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array()
    });
  }
  next();
};

/**
 * @route   POST /api/kiosk/toggle
 * @desc    Toggle kiosk mode (enable/disable) for authenticated print agent
 * @access  Private (Print Agent only)
 * @body    { "enable": true/false }
 * @returns { success, message, data: { is_enabled, confirmation_code?, code_expiry?, last_toggle_at } }
 */
router.post(
  "/toggle",
  verifyToken("printAgent"),
  validateToggleKiosk,
  handleValidationErrors,
  toggleKioskMode
);

/**
 * @route   POST /api/kiosk/verify
 * @desc    Verify confirmation code for kiosk mode access
 * @access  Public
 * @body    { "confirmation_code": "123456" }
 * @returns { success, message, data: { print_agent, kiosk_enabled, code_expiry } }
 */
router.post(
  "/verify",
  validateConfirmationCode,
  handleValidationErrors,
  verifyConfirmationCode
);

/**
 * @route   GET /api/kiosk/status
 * @desc    Get current kiosk status for authenticated print agent
 * @access  Private (Print Agent only)
 * @returns { success, message, data: { is_enabled, has_active_code, code_expiry?, last_toggle_at? } }
 */
router.get(
  "/status",
  verifyToken("printAgent"),
  getKioskStatus
);

module.exports = router;