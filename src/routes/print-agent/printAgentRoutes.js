const express = require("express");
const mongoose = require("mongoose");
const verifyToken = require("../../middleware/verifyToken.js");
const PrintAgent = require("../../models/print-agent-schema.js");
const Location = require("../../models/locations-schema.js");
const otpGenerator = require("otp-generator");
const mailOptions = require("../../utils/mailOTP.js");
const nodemailer = require("nodemailer");
const Card = require("../../models/card-schema.js");
const validateUpdateCard = require("../../middleware/validateCard.js");
const PrintJob = require("../../models/print-job-schema.js");
const ChatSession = require("../../models/chat-session-schema.js");
const Message = require("../../models/message-schema.js");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

router.post("/additional-info", verifyToken("printAgent"), async (req, res) => {
  try {
    const { personal_info, location, personal_phone_number, card } = req.body;

    const printAgent = await PrintAgent.findById(req.user.id);
    if (!printAgent) {
      return res.status(400).json({ message: "User not found" });
    }

    // Validate and process location if provided
    if (location) {
      if (!location.zip_code) {
        return res.status(400).json({ message: "Zip code is required for location" });
      }

      const lowerCaseZipCode = location.zip_code.toLowerCase();

      // Check if location exists in the Location schema
      const existingLocation = await Location.findOne({
        zip_code: lowerCaseZipCode,
      });

      if (!existingLocation) {
        return res.status(400).json({ message: "Location not supported in our service area" });
      }

      // Update location with normalized zip code and set reference
      printAgent.location = {
        ...location,
        zip_code: lowerCaseZipCode,
      };
      printAgent.locationRef = existingLocation._id;
    }

    // Update other fields
    if (personal_info !== undefined) {
      printAgent.personal_info = personal_info;
    }
    if (personal_phone_number !== undefined) {
      printAgent.personal_phone_number = personal_phone_number;
    }

    // Handle card creation if provided
    if (card) {
      const newCard = new Card({
        ...card,
        user_id: printAgent._id,
        ref_type: "PrintAgent",
      });
      await newCard.save();
      printAgent.cards = [newCard._id];
    }

    await printAgent.save();
    res.status(200).json({ 
      message: "Additional info updated successfully",
      location: printAgent.location ? printAgent.location : undefined
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error", err });
  }
});

// check if print agent has a stripe account
router.get(
  "/check-connect-account",
  verifyToken("printAgent"),
  async (req, res) => {
    try {
      const printAgent = await PrintAgent.findById(req.user.id);

      if (!printAgent) {
        return res.status(200).json({ message: "User not found" });
      }

      if (!printAgent.stripe_account_id) {
        return res.status(200).json({
          message: "No stripe account found",
          hasStripeAccount: false,
        });
      }

      // check if the stripe account exists
      const account = await stripe.accounts.retrieve(
        printAgent.stripe_account_id,
      );

      if (!account) {
        return res.status(200).json({
          message: "No stripe account found",
          hasStripeAccount: false,
        });
      }

      console.log(account);

      // Check the account's onboarding status
      const status = {
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        requirements: account.requirements,
        verification: account.verification,
      };

      res.status(200).json({
        message: "Stripe account found",
        account_id: printAgent.stripe_account_id,
        hasStripeAccount: true,
        account: account,
        status,
      });
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: "Server error", error });
    }
  },
);

// create a stripe connect account for the print agent
router.get(
  "/create-connect-account",
  verifyToken("printAgent"),
  async (req, res) => {
    try {
      const printAgent = await PrintAgent.findById(req.user.id);
      if (!printAgent) {
        return res.status(400).json({ message: "User not found" });
      }

      if (!printAgent.stripe_account_id) {
        const account = await stripe.accounts.create({
          type: "express",
          email: printAgent.email,
        });
        printAgent.stripe_account_id = account.id;
        await printAgent.save();
      }

      console.log({ "account id": printAgent.stripe_account_id });

      const links = await stripe.accountLinks.create({
        account: printAgent.stripe_account_id,
        refresh_url: process.env.Base_URL,
        return_url: process.env.Base_URL,
        type: "account_onboarding",
      });

      res
        .status(200)
        .json({ message: "Account created successfully", url: links.url });
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: "Server error", error });
    }
  },
);

router.post("/create-card", verifyToken("printAgent"), async (req, res) => {
  try {
    const { card } = req.body;
    //INFO: req.user.id is the id we get from the token
    const printAgent = await PrintAgent.findById(req.user.id);
    if (!printAgent) {
      return res.status(400).json({ message: "User not found" });
    }

    const newCard = new Card({
      ...card,
      user_id: printAgent._id,
      ref_type: "PrintAgent",
    });

    await newCard.save();
    printAgent.cards.push(newCard._id);
    await printAgent.save();

    res
      .status(201)
      .json({ message: "Card created successfully", card: newCard });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error", err });
  }
});

router.get("/get-cards", verifyToken("printAgent"), async (req, res) => {
  try {
    const printAgent = await PrintAgent.findById(req.user.id).populate("cards");
    if (!printAgent) {
      return res.status(400).json({ message: "User not found" });
    }
    if (!printAgent.cards || printAgent.cards.length === 0) {
      return res.status(404).json({ message: "No cards found for this user" });
    }
    res.status(200).json({
      message: "Cards retrieved successfully",
      cards: printAgent.cards,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error", err });
  }
});

router.get("/get-card/:cardId", verifyToken("printAgent"), async (req, res) => {
  try {
    const { cardId } = req.params;

    const card = await Card.findById(cardId);
    if (!card) {
      return res.status(404).json({ message: "Card not found" });
    }

    const printAgent = await PrintAgent.findById(req.user.id);
    if (!printAgent || !printAgent.cards.includes(cardId)) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    res.status(200).json({ message: "Card retrieved successfully", card });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error", err });
  }
});

//INFO: allows partial updates
router.delete(
  "/delete-card/:cardId",
  verifyToken("printAgent"),
  async (req, res) => {
    try {
      const { cardId } = req.params;
      const printAgent = await PrintAgent.findById(req.user.id);
      if (!printAgent) {
        return res.status(400).json({ message: "User not found" });
      }

      const card = await Card.findById(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }

      if (!printAgent.cards.includes(cardId)) {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      await Card.deleteOne({ _id: cardId });
      printAgent.cards = printAgent.cards.filter((id) => id !== cardId);
      await printAgent.save();

      res.status(200).json({ message: "Card deleted successfully" });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ message: "Server error", err });
    }
  },
);
//  PUT request to update card
//  INFO: allows partial updates

router.put(
  "/update-card/:cardId",
  verifyToken("printAgent"),
  validateUpdateCard,
  async (req, res) => {
    try {
      const { cardId } = req.params;
      const { bank_name, card_number, expiry_date, phone_number, cvv } =
        req.body;

      const printAgent = await PrintAgent.findById(req.user.id);
      if (!printAgent) {
        return res.status(400).json({ message: "User not found" });
      }

      const cardToUpdate = await Card.findById(cardId);
      if (!cardToUpdate) {
        return res.status(404).json({ message: "Card not found" });
      }

      if (!printAgent.cards.includes(cardId)) {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      cardToUpdate.bank_name = bank_name ?? cardToUpdate.bank_name;
      cardToUpdate.card_number = card_number ?? cardToUpdate.card_number;
      cardToUpdate.expiry_date = expiry_date ?? cardToUpdate.expiry_date;
      cardToUpdate.phone_number = phone_number ?? cardToUpdate.phone_number;
      cardToUpdate.cvv = cvv ?? cardToUpdate.cvv;

      await cardToUpdate.save();

      res.status(200).json({ message: "Card updated successfully" });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ message: "Server error", err });
    }
  },
);

// should send a mail with an otp which when entered switches the is_available to true and vice versa
router.get("/online-status", verifyToken("printAgent"), async (req, res) => {
  try {
    const printAgent = await PrintAgent.findById(req.user.id);
    if (!printAgent) {
      return res.status(404).json({ message: "User not found" });
    }
    const email = printAgent.email;
    const name = printAgent.full_name;

    const otp = otpGenerator.generate(6, {
      digits: true,
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
      specialChars: false,
    });

    printAgent.availability_otp = otp;
    printAgent.availability_otp_expiry = Date.now() + 10 * 60 * 1000;
    await printAgent.save();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: "printtopointsaas@gmail.com",
        pass: "jqxl mqqo xkrk pwny",
      },
    });

    transporter.sendMail(mailOptions(email, name, otp), (error) => {
      if (error) {
        return res.status(500).json({ message: "Error sending email" });
      }
      res.status(200).json({ message: "OTP sent to your email" });
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Server error", error });
  }
});

router.get("/status-otp/:otp", verifyToken("printAgent"), async (req, res) => {
  try {
    const { otp } = req.params;
    const printAgent = await PrintAgent.findById(req.user.id);

    if (!printAgent) {
      return res.status(404).json({ message: "User not found" });
    }

    if (
      printAgent.availability_otp !== otp ||
      printAgent.availability_otp_expiry < Date.now()
    ) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    printAgent.is_available = !printAgent.is_available;
    printAgent.availability_otp = undefined;
    printAgent.availability_otp_expiry = undefined;
    await printAgent.save();

    res.status(200).json({ message: "Availability updated successfully" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error", err });
  }
});

// Kiosk mode toggle - send OTP to email for verification
router.get("/kiosk-mode", verifyToken("printAgent"), async (req, res) => {
  try {
    const printAgent = await PrintAgent.findById(req.user.id);
    if (!printAgent) {
      return res.status(404).json({ message: "User not found" });
    }
    const email = printAgent.email;
    const name = printAgent.full_name;

    const otp = otpGenerator.generate(6, {
      digits: true,
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
      specialChars: false,
    });

    printAgent.kiosk_mode_otp = otp;
    printAgent.kiosk_mode_otp_expiry = Date.now() + 10 * 60 * 1000;
    await printAgent.save();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: "printtopointsaas@gmail.com",
        pass: "jqxl mqqo xkrk pwny",
      },
    });

    transporter.sendMail(mailOptions(email, name, otp), (error) => {
      if (error) {
        return res.status(500).json({ message: "Error sending email" });
      }
      res.status(200).json({ message: "OTP sent to your email" });
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Server error", error });
  }
});

// Verify kiosk mode OTP and toggle kiosk status
router.get("/kiosk-otp/:otp", verifyToken("printAgent"), async (req, res) => {
  try {
    const { otp } = req.params;
    const printAgent = await PrintAgent.findById(req.user.id);

    if (!printAgent) {
      return res.status(404).json({ message: "User not found" });
    }

    if (
      printAgent.kiosk_mode_otp !== otp ||
      printAgent.kiosk_mode_otp_expiry < Date.now()
    ) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    printAgent.is_kiosk_enabled = !printAgent.is_kiosk_enabled;
    printAgent.kiosk_mode_otp = undefined;
    printAgent.kiosk_mode_otp_expiry = undefined;
    await printAgent.save();

    res.status(200).json({ 
      message: "Kiosk mode updated successfully",
      is_kiosk_enabled: printAgent.is_kiosk_enabled
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error", err });
  }
});

router.get("/all-customers", verifyToken("printAgent"), async (req, res) => {
  try {
    const printAgent = await PrintAgent.findById(req.user.id);
    if (!printAgent) {
      return res.status(400).json({ message: "User not found" });
    }

    const printJobs = await PrintJob.find({ print_agent_id: printAgent._id })
      .populate("customer_id", "full_name email location")
      .exec();

    const customers = printJobs
      .map((job) => job.customer_id)
      .filter((customer) => customer !== null)
      .filter(
        (customer, index, self) =>
          self.findIndex((c) => c._id.equals(customer._id)) === index,
      );

    res
      .status(200)
      .json({ message: "Customers retrieved successfully", customers });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error", err });
  }
});

router.get("/summary", verifyToken("printAgent"), async (req, res) => {
  try {
    const printAgent = await PrintAgent.findById(req.user.id);
    if (!printAgent) {
      return res.status(400).json({ message: "User not found" });
    }

    const printJobs = await PrintJob.find({ print_agent_id: printAgent._id })
      .populate("customer_id", "_id")
      .exec();

    const totalOrders = printJobs.length;
    const uniqueCustomers = printJobs
      .map((job) => job.customer_id)
      .filter((customer) => customer !== null);
    const totalCustomers = new Set(
      uniqueCustomers.map((customer) => customer._id.toString()),
    ).size;
    const totalCompletedJobs = printJobs.filter(
      (job) => job.payment_status === "completed",
    ).length;
    const totalPendingJobs = printJobs.filter(
      (job) => job.payment_status === "pending",
    ).length;
    const totalRevenue = printJobs
      .filter((job) => job.payment_status === "completed")
      .reduce((sum, job) => sum + job.total_cost, 0);
    const averageJobValue =
      totalCompletedJobs > 0
        ? (totalRevenue / totalCompletedJobs).toFixed(2)
        : 0;
    const jobCompletionRate =
      totalOrders > 0
        ? ((totalCompletedJobs / totalOrders) * 100).toFixed(2)
        : 0;
    const lastJobDate =
      printJobs.length > 0
        ? new Date(
            Math.max(...printJobs.map((job) => new Date(job.created_at))),
          ).toISOString()
        : null;
    const totalPagesPrinted = printJobs.reduce(
      (sum, job) => sum + job.pages,
      0,
    );

    res.status(200).json({
      message: "Summary retrieved successfully",
      totalOrders,
      totalCustomers,
      totalCompletedJobs,
      totalPendingJobs,
      totalRevenue,
      averageJobValue,
      jobCompletionRate,
      lastJobDate,
      totalPagesPrinted,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error", err });
  }
});

router.get("/print-jobs", verifyToken("printAgent"), async (req, res) => {
  try {
    console.log(req.user.id);
    const printJobs = await PrintJob.find({ print_agent_id: req.user.id });
    res.status(200).json({
      message: "All print jobs fetched successfully",
      printJobs,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", err });
  }
});

// Check if print agent is online or offline
router.get("/if-online", verifyToken("printAgent"), async (req, res) => {
  try {
    const printAgent = await PrintAgent.findById(req.user.id);
    
    if (!printAgent) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "Status retrieved successfully",
      is_available: printAgent.is_available,
      status: printAgent.is_available ? "online" : "offline"
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error", err });
  }
});

// Check if print agent has kiosk mode enabled
router.get("/kiosk-status", verifyToken("printAgent"), async (req, res) => {
  try {
    const printAgent = await PrintAgent.findById(req.user.id);
    
    if (!printAgent) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "Kiosk status retrieved successfully",
      is_kiosk_enabled: printAgent.is_kiosk_enabled,
      status: printAgent.is_kiosk_enabled ? "enabled" : "disabled"
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error", err });
  }
});

// DELETE /api/print-agent/delete-account - Delete print agent account and all associated data
router.delete("/delete-account", verifyToken("printAgent"), async (req, res) => {
  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();

  try {
    const printAgentId = req.user.id;
    const printAgent = await PrintAgent.findById(printAgentId).session(dbSession);
    
    if (!printAgent) {
      await dbSession.abortTransaction();
      await dbSession.endSession();
      return res.status(404).json({ message: "Print agent not found" });
    }

    // Count items before deletion for response
    const cardsCount = printAgent.cards?.length || 0;
    const chatSessions = await ChatSession.find({ agent_id: printAgentId }).session(dbSession);
    const chatSessionsCount = chatSessions.length;
    const chatSessionIds = chatSessions.map(chatSession => chatSession._id);
    const messagesCount = chatSessionIds.length > 0 
      ? await Message.countDocuments({ chat_session_id: { $in: chatSessionIds } }).session(dbSession)
      : 0;
    const printJobsCount = await PrintJob.countDocuments({ print_agent_id: printAgentId }).session(dbSession);

    // Delete all cards associated with the print agent
    if (cardsCount > 0) {
      await Card.deleteMany({ 
        _id: { $in: printAgent.cards },
        ref_type: "PrintAgent",
        user_id: printAgentId
      }).session(dbSession);
    }

    // Delete all messages in chat sessions
    if (messagesCount > 0 && chatSessionIds.length > 0) {
      await Message.deleteMany({ chat_session_id: { $in: chatSessionIds } }).session(dbSession);
    }
    
    // Delete all chat sessions
    if (chatSessionsCount > 0) {
      await ChatSession.deleteMany({ agent_id: printAgentId }).session(dbSession);
    }

    // Handle print jobs - keep them for records but set print_agent_id to null
    // This preserves business records while removing print agent association
    if (printJobsCount > 0) {
      await PrintJob.updateMany(
        { print_agent_id: printAgentId },
        { $set: { print_agent_id: null } }
      ).session(dbSession);
    }

    // Note: We don't delete the Stripe account as it may contain financial records
    // The Stripe account can be manually deactivated if needed
    // If stripe_account_id exists, you may want to log it for admin review
    const stripeAccountId = printAgent.stripe_account_id || null;

    // Delete the print agent account
    await PrintAgent.deleteOne({ _id: printAgentId }).session(dbSession);

    // Commit the transaction
    await dbSession.commitTransaction();
    await dbSession.endSession();

    res.status(200).json({ 
      message: "Account deleted successfully",
      deleted: {
        printAgent: true,
        cards: cardsCount,
        chatSessions: chatSessionsCount,
        messages: messagesCount,
        printJobsUpdated: printJobsCount,
        stripeAccountId: stripeAccountId
      }
    });
  } catch (err) {
    // Abort transaction on error
    await dbSession.abortTransaction();
    await dbSession.endSession();
    console.error("Error deleting print agent account:", err.message);
    res.status(500).json({ 
      message: "Server error while deleting account", 
      error: err.message 
    });
  }
});

module.exports = router;
