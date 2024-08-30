const Customer = require("../../models/customer.js");
const mailOptions = require("../../utils/mailOptions.js");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const otpGenerator = require("otp-generator");
const nodemailer = require("nodemailer");
const router = express.Router();

router.post("/signup", async (req, res) => {
  try {
    const { email, password } = req.body;

    let customer = await Customer.findOne({ email });
    if (customer) {
      return res.status(400).send("User already exists");
    }

    const otp = otpGenerator.generate(6, {
      digits: true,
      alphabets: true,
      upperCase: true,
      specialChars: false,
    });
    const otp_expiry = new Date(Date.now() + 300000);

    console.log("Generated OTP:", otp, "Expiry Time:", otp_expiry);

    customer = new Customer({
      email,
      password,
      otp, // Correctly set here
      otp_expiry, // Correctly set here
    });

    console.log("Customer object before saving:", customer);

    await customer.save();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: "infosynthseer@gmail.com",
        pass: "kegj ytci koqp dveq",
      },
    });

    transporter.sendMail(mailOptions(email, otp, "customer"), (error, info) => {
      if (error) {
        console.log("Error sending email:", error);
        return res.status(500).json({ message: "Error sending email" });
      }
      console.log("Email sent successfully:", info.response);
      res.status(200).json({ message: "OTP sent to your email" });
    });
  } catch (err) {
    console.error("Server error:", err); // Log the whole error object
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auth/customer/verify-otp (customer)
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    const customer = await Customer.findOne({ email });

    if (!customer) {
      return res.status(400).json({ message: "User not found" });
    }

    const current = new Date();
    if (current > customer.otp_expiry) {
      return res.status(400).json({ message: "OTP expired" });
    }

    if (customer.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    customer.verified_email = true;
    customer.otp = null;
    customer.otp_expiry = null;
    await customer.save();
    const payload = {
      user: {
        id: customer.id,
      },
    };
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: "5h" },
      (err, token) => {
        if (err) throw err;
        res.json({ message: "OTP verified successfully", token });
      },
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/auth/customer/login (customer)
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const customer = await Customer.findOne({ email });
    if (!customer) {
      return res.status(400).json({ message: "User not found" });
    }
    if (!customer.verified_email) {
      return res.status(400).json({ message: "Email not verified" });
    }
    if (!customer.password) {
      return res.status(400).json({ message: "Password not set" });
    }
    const isMatch = await bcrypt.compare(password, customer.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }
    const payload = {
      user: {
        id: customer.id,
      },
    };
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: "5h" },
      (err, token) => {
        if (err) throw err;
        res.status(200).json({ message: "Logged in successfully", token });
      },
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
