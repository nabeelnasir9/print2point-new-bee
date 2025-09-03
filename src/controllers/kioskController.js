const Kiosk = require("../models/kiosk-schema.js");
const PrintAgent = require("../models/print-agent-schema.js");
const otpGenerator = require("otp-generator");

// Toggle kiosk mode (enable/disable)
const toggleKioskMode = async (req, res) => {
  try {
    const printAgentId = req.user.id;
    const { enable } = req.body;

    // Verify print agent exists
    const printAgent = await PrintAgent.findById(printAgentId);
    if (!printAgent) {
      return res.status(404).json({ 
        success: false, 
        message: "Print agent not found" 
      });
    }

    // Find or create kiosk record for this print agent
    let kiosk = await Kiosk.findOne({ print_agent_id: printAgentId });
    
    if (!kiosk) {
      kiosk = new Kiosk({ print_agent_id: printAgentId });
    }

    // Generate confirmation code if enabling kiosk mode
    if (enable) {
      const confirmationCode = otpGenerator.generate(6, {
        digits: true,
        lowerCaseAlphabets: false,
        upperCaseAlphabets: false,
        specialChars: false,
      });

      // Set expiry to 24 hours from now
      const codeExpiry = new Date();
      codeExpiry.setHours(codeExpiry.getHours() + 24);

      kiosk.is_enabled = true;
      kiosk.confirmation_code = confirmationCode;
      kiosk.code_expiry = codeExpiry;
      kiosk.last_toggle_at = new Date();

      await kiosk.save();

      return res.status(200).json({
        success: true,
        message: "Kiosk mode enabled successfully",
        data: {
          is_enabled: true,
          confirmation_code: confirmationCode,
          code_expiry: codeExpiry,
          last_toggle_at: kiosk.last_toggle_at
        }
      });
    } else {
      // Disable kiosk mode
      kiosk.is_enabled = false;
      kiosk.confirmation_code = null;
      kiosk.code_expiry = null;
      kiosk.last_toggle_at = new Date();

      await kiosk.save();

      return res.status(200).json({
        success: true,
        message: "Kiosk mode disabled successfully",
        data: {
          is_enabled: false,
          last_toggle_at: kiosk.last_toggle_at
        }
      });
    }
  } catch (error) {
    console.error("Error toggling kiosk mode:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Verify confirmation code
const verifyConfirmationCode = async (req, res) => {
  try {
    const { confirmation_code } = req.body;

    if (!confirmation_code) {
      return res.status(400).json({
        success: false,
        message: "Confirmation code is required"
      });
    }

    // Find kiosk by confirmation code
    const kiosk = await Kiosk.findOne({ 
      confirmation_code: confirmation_code,
      is_enabled: true 
    }).populate('print_agent_id', 'business_name full_name email');

    if (!kiosk) {
      return res.status(404).json({
        success: false,
        message: "Invalid confirmation code or kiosk mode not enabled"
      });
    }

    // Check if code has expired
    if (kiosk.code_expiry && new Date() > kiosk.code_expiry) {
      // Auto-disable expired kiosk mode
      kiosk.is_enabled = false;
      kiosk.confirmation_code = null;
      kiosk.code_expiry = null;
      await kiosk.save();

      return res.status(400).json({
        success: false,
        message: "Confirmation code has expired. Kiosk mode disabled."
      });
    }

    return res.status(200).json({
      success: true,
      message: "Confirmation code verified successfully",
      data: {
        print_agent: {
          id: kiosk.print_agent_id._id,
          business_name: kiosk.print_agent_id.business_name,
          full_name: kiosk.print_agent_id.full_name
        },
        kiosk_enabled: kiosk.is_enabled,
        code_expiry: kiosk.code_expiry
      }
    });
  } catch (error) {
    console.error("Error verifying confirmation code:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Get current kiosk status for authenticated print agent
const getKioskStatus = async (req, res) => {
  try {
    const printAgentId = req.user.id;

    const kiosk = await Kiosk.findOne({ print_agent_id: printAgentId });

    if (!kiosk) {
      return res.status(200).json({
        success: true,
        message: "No kiosk configuration found",
        data: {
          is_enabled: false,
          has_active_code: false
        }
      });
    }

    // Check if current code is expired
    const isCodeExpired = kiosk.code_expiry && new Date() > kiosk.code_expiry;
    
    if (isCodeExpired && kiosk.is_enabled) {
      // Auto-disable expired kiosk mode
      kiosk.is_enabled = false;
      kiosk.confirmation_code = null;
      kiosk.code_expiry = null;
      await kiosk.save();
    }

    return res.status(200).json({
      success: true,
      message: "Kiosk status retrieved successfully",
      data: {
        is_enabled: kiosk.is_enabled && !isCodeExpired,
        has_active_code: kiosk.confirmation_code && !isCodeExpired,
        code_expiry: isCodeExpired ? null : kiosk.code_expiry,
        last_toggle_at: kiosk.last_toggle_at
      }
    });
  } catch (error) {
    console.error("Error getting kiosk status:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

module.exports = {
  toggleKioskMode,
  verifyConfirmationCode,
  getKioskStatus
};