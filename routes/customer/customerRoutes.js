const express = require("express");
const verifyToken = require("../../middleware/verifyToken.js");
const Customer = require("../../models/customer-schema.js");
const Card = require("../../models/card-schema.js");
const validateUpdateCard = require("../../middleware/validateCard.js");
const router = express.Router();

router.post("/create-card", verifyToken, async (req, res) => {
  try {
    const { card } = req.body;
    const customer = await Customer.findById(req.user.id);
    if (!customer) {
      return res.status(400).json({ message: "User not found" });
    }

    const newCard = new Card({
      ...card,
      user_id: customer._id,
      ref_type: "User",
    });

    await newCard.save();
    customer.cards.push(newCard._id);
    await customer.save();

    res.status(201).json({ message: "Card created successfully" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/get-cards", verifyToken, async (req, res) => {
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
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/get-card/:cardId", verifyToken, async (req, res) => {
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

router.delete("/delete-card/:cardId", verifyToken, async (req, res) => {
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
    res.status(500).json({ message: "Server error" });
  }
});

//  PUT request to update card
//  INFO: allows partial updates

router.put("/update-card/:cardId", verifyToken, async (req, res) => {
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
    res.status(500).json({ message: "Server error" });
  }
});

router.put(
  "/update-card/:cardId",
  verifyToken,
  validateUpdateCard,
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

      cardToUpdate.bank_name = bank_name ?? cardToUpdate.bank_name;
      cardToUpdate.card_number = card_number ?? cardToUpdate.card_number;
      cardToUpdate.expiry_date = expiry_date ?? cardToUpdate.expiry_date;
      cardToUpdate.phone_number = phone_number ?? cardToUpdate.phone_number;

      await cardToUpdate.save();

      res.status(200).json({ message: "Card updated successfully" });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ message: "Server error" });
    }
  },
);

module.exports = router;
