const express = require("express");
const mongoose = require("mongoose");
const Location = require("../../models/locations-schema.js");
const verifyToken = require("../../middleware/verifyToken.js");
const PrintAgent = require("../../models/print-agent-schema.js");
const Tickets = require("../../models/tickets-schema.js");
const nodemailer = require("nodemailer");
const Customer = require("../../models/customer-schema.js");
const Card = require("../../models/card-schema.js");
const validateUpdateCard = require("../../middleware/validateCard.js");
const ChatSession = require("../../models/chat-session-schema.js");
const Message = require("../../models/message-schema.js");
const PrintJob = require("../../models/print-job-schema.js");
const router = express.Router();

// GET /api/customer/profile - Get user profile information
router.get("/profile", verifyToken("customer"), async (req, res) => {
  try {
    const customer = await Customer.findById(req.user.id);
    if (!customer) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if customer has location set
    const has_location = !!(customer.location && (
      customer.location.city || 
      customer.location.state || 
      customer.location.zip_code || 
      customer.location.country
    ));

    const userProfile = {
      id: customer._id,
      full_name: customer.full_name,
      email: customer.email,
      location: customer.location || null,
      has_location: has_location,
      verified_email: customer.verified_email,
      created_at: customer.created_at,
      updated_at: customer.updated_at
    };

    res.status(200).json({
      message: "User profile retrieved successfully",
      user: userProfile
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error", err });
  }
});

router.post("/create-card", verifyToken("customer"), async (req, res) => {
  try {
    const { card } = req.body;
    const customer = await Customer.findById(req.user.id);
    if (!customer) {
      return res.status(400).json({ message: "User not found" });
    }

    const newCard = new Card({
      ...card,
      user_id: customer._id,
      ref_type: "Customer",
    });

    await newCard.save();
    customer.cards.push(newCard._id);
    await customer.save();

    res
      .status(201)
      .json({ message: "Card created successfully", card: newCard._id });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error", err });
  }
});

router.get("/get-cards", verifyToken("customer"), async (req, res) => {
  try {
    const customer = await Customer.findById(req.user.id).populate("cards");
    if (!customer) {
      return res.status(400).json({ message: "User not found" });
    }

    if (!customer.cards || customer.cards.length === 0) {
      return res.status(404).json({ message: "No cards found for this user" });
    }
    res
      .status(200)
      .json({ message: "Cards retrieved successfully", cards: customer.cards });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error", err });
  }
});

router.get("/get-card/:cardId", verifyToken("customer"), async (req, res) => {
  try {
    const { cardId } = req.params;

    const card = await Card.findById(cardId);
    if (!card) {
      return res.status(404).json({ message: "Card not found" });
    }

    const customer = await Customer.findById(req.user.id);
    if (!customer || !customer.cards.includes(cardId)) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    res.status(200).json({ message: "Card retrieved successfully", card });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.delete(
  "/delete-card/:cardId",
  verifyToken("customer"),
  async (req, res) => {
    try {
      const { cardId } = req.params;
      const customer = await Customer.findById(req.user.id);
      if (!customer) {
        return res.status(400).json({ message: "User not found" });
      }

      const card = await Card.findById(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }

      if (!customer.cards.includes(cardId)) {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      await Card.deleteOne({ _id: cardId });
      customer.cards = customer.cards.filter((id) => id !== cardId);
      await customer.save();

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
  verifyToken("customer"),
  async (req, res) => {
    try {
      const { cardId } = req.params;
      const { bank_name, card_number, expiry_date, phone_number } = req.body;

      const customer = await Customer.findById(req.user.id);
      if (!customer) {
        return res.status(400).json({ message: "User not found" });
      }

      const cardToUpdate = await Card.findById(cardId);
      if (!cardToUpdate) {
        return res.status(404).json({ message: "Card not found" });
      }

      if (!customer.cards.includes(cardId)) {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      if (bank_name !== undefined) {
        cardToUpdate.bank_name = bank_name;
      }
      if (card_number !== undefined) {
        cardToUpdate.card_number = card_number;
      }
      if (expiry_date !== undefined) {
        cardToUpdate.expiry_date = expiry_date;
      }
      if (phone_number !== undefined) {
        cardToUpdate.phone_number = phone_number;
      }

      await cardToUpdate.save();

      res.status(200).json({ message: "Card updated successfully" });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ message: "Server error", err });
    }
  },
);

router.put(
  "/update-card/:cardId",
  verifyToken("customer"),
  validateUpdateCard,
  async (req, res) => {
    try {
      const { cardId } = req.params;
      const { bank_name, card_number, expiry_date, phone_number, cvv } =
        req.body;

      const customer = await Customer.findById(req.user.id);
      if (!customer) {
        return res.status(400).json({ message: "User not found" });
      }

      const cardToUpdate = await Card.findById(cardId);
      if (!cardToUpdate) {
        return res.status(404).json({ message: "Card not found" });
      }

      if (!customer.cards.includes(cardId)) {
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

router.post("/add-location", verifyToken("customer"), async (req, res) => {
  try {
    const { location } = req.body;
    const customer = await Customer.findById(req.user.id);
    if (!customer) {
      return res.status(400).json({ message: "User not found" });
    }
    const lowerCaseZipCode = location.zip_code.toLowerCase();

    customer.location = {
      ...location,
      zip_code: lowerCaseZipCode,
    };
    await customer.save();

    res.status(200).json({
      message: "Location added successfully",
      location: customer.location,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Server error", error });
  }
});

router.get(
  "/available-print-agents",
  verifyToken("customer"),
  async (req, res) => {
    try {
      const customer = await Customer.findById(req.user.id);
      if (!customer) {
        return res.status(400).json({ message: "User not found" });
      }
      const Agents = await PrintAgent.find({});
      const availablePrintAgents = Agents.filter(
        (agent) =>
          agent.is_available === true && agent.is_deactivated === false,
      );

      // const locations = await Location.find({}).populate("printAgents");
      //
      // // Flatten the array of print agents and filter by availability
      // const availablePrintAgents = locations
      //   .flatMap((location) => location.printAgents)
      //   .filter(
      //     (agent) =>
      //       agent.is_available === true && agent.is_deactivated === false,
      //   );

      res.status(200).json({
        message: "Locations retrieved successfully",
        availablePrintAgents,
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ message: "Server error", err });
    }
  },
);
// What the body will look like for the tickets
// {
//   full_name: "John Doe",
//   email: "johndoe@example.com",
//   order_number: "123456789",
//   message: "Please deliver the package to the address",
//   bank: {
//     bank_name: "Bank of America",
//     bank_number: "123456789",
//     full_name_bank: "John Doe",
//   },
// }

router.post("/create-ticket", verifyToken("customer"), async (req, res) => {
  try {
    // The bank details are not required for the ticket but can be added here.
    const { full_name, email, order_number, message, bank } = req.body;
    const customer = await Customer.findById(req.user.id);
    if (!customer) {
      return res.status(400).json({ message: "User not found" });
    }

    const newTicket = new Tickets({
      full_name,
      email,
      order_number,
      message,
      status: "pending",
      customer_id: customer._id,
      bank,
    });

    await newTicket.save();
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
    transporter.sendMail(
      {
        from: process.env.EMAIL,
        to: process.env.EMAIL,
        subject: "Ticket created",
        html: `
            <div>
              <p>New ticket created</p>
            <p>Full name: ${full_name}</p>
            <p>Email: ${email}</p>
            <p>Order number: ${order_number}</p>
            <p>Message: ${message}</p>
            </div>
`,
      },
      (error) => {
        if (error) {
          return res.status(500).json({ message: "Error sending email" });
        }
      },
    );

    res
      .status(201)
      .json({ message: "Ticket created successfully", ticket: newTicket });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error", err });
  }
});

// DELETE /api/customer/delete-account - Delete customer account and all associated data
router.delete("/delete-account", verifyToken("customer"), async (req, res) => {
  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();

  try {
    const customerId = req.user.id;
    const customer = await Customer.findById(customerId).session(dbSession);
    
    if (!customer) {
      await dbSession.abortTransaction();
      await dbSession.endSession();
      return res.status(404).json({ message: "Customer not found" });
    }

    // Count items before deletion for response
    const cardsCount = customer.cards?.length || 0;
    const ticketsCount = await Tickets.countDocuments({ customer_id: customerId }).session(dbSession);
    const chatSessions = await ChatSession.find({ customer_id: customerId }).session(dbSession);
    const chatSessionsCount = chatSessions.length;
    const chatSessionIds = chatSessions.map(chatSession => chatSession._id);
    const messagesCount = chatSessionIds.length > 0 
      ? await Message.countDocuments({ chat_session_id: { $in: chatSessionIds } }).session(dbSession)
      : 0;
    const printJobsCount = await PrintJob.countDocuments({ customer_id: customerId }).session(dbSession);

    // Delete all cards associated with the customer
    if (cardsCount > 0) {
      await Card.deleteMany({ 
        _id: { $in: customer.cards },
        ref_type: "Customer",
        user_id: customerId
      }).session(dbSession);
    }

    // Delete all tickets associated with the customer
    if (ticketsCount > 0) {
      await Tickets.deleteMany({ customer_id: customerId }).session(dbSession);
    }

    // Delete all messages in chat sessions
    if (messagesCount > 0 && chatSessionIds.length > 0) {
      await Message.deleteMany({ chat_session_id: { $in: chatSessionIds } }).session(dbSession);
    }
    
    // Delete all chat sessions
    if (chatSessionsCount > 0) {
      await ChatSession.deleteMany({ customer_id: customerId }).session(dbSession);
    }

    // Handle print jobs - keep them for records but set customer_id to null
    // This preserves business records while removing customer association
    if (printJobsCount > 0) {
      await PrintJob.updateMany(
        { customer_id: customerId },
        { $set: { customer_id: null } }
      ).session(dbSession);
    }

    // Delete the customer account
    await Customer.deleteOne({ _id: customerId }).session(dbSession);

    // Commit the transaction
    await dbSession.commitTransaction();
    await dbSession.endSession();

    res.status(200).json({ 
      message: "Account deleted successfully",
      deleted: {
        customer: true,
        cards: cardsCount,
        tickets: ticketsCount,
        chatSessions: chatSessionsCount,
        messages: messagesCount,
        printJobsUpdated: printJobsCount
      }
    });
  } catch (err) {
    // Abort transaction on error
    await dbSession.abortTransaction();
    await dbSession.endSession();
    console.error("Error deleting customer account:", err.message);
    res.status(500).json({ 
      message: "Server error while deleting account", 
      error: err.message 
    });
  }
});

module.exports = router;
