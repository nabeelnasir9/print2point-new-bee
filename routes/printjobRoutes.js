const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const verifyToken = require("../middleware/verifyToken.js");
const PrintJob = require("../models/print-job-schema.js");
const otpGenerator = require("otp-generator");
const Customer = require("../models/customer-schema.js");
const router = express.Router();
const fs = require("fs");
const multer = require("multer");
const util = require("util");
const cloudinary = require("cloudinary").v2;

const unlinkFile = util.promisify(fs.unlink);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const calculateCost = (pages) => {
  return pages * 0.01;
};

const upload = multer({ dest: "uploads/" });

router.post(
  "/create-print-job",
  verifyToken("customer"),
  upload.single("file"),
  async (req, res) => {
    try {
      const { print_job_title, print_job_description } = req.body;

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Check if the customer already has a Stripe customer ID
      const customer = await Customer.findById(req.user.id);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      let stripeCustomerId = customer.stripe_customer_id;
      if (!stripeCustomerId) {
        // Create a new Stripe customer
        const stripeCustomer = await stripe.customers.create({
          email: customer.email,
          name: customer.full_name,
        });
        stripeCustomerId = stripeCustomer.id;
        customer.stripe_customer_id = stripeCustomerId;
        await customer.save();
      }

      // Upload file to Cloudinary
      const result = await cloudinary.uploader.upload(req.file.path, {
        resource_type: "auto",
        folder: "print_jobs",
        use_filename: true,
        unique_filename: true,
      });

      // Delete the local file after uploading to Cloudinary
      await unlinkFile(req.file.path);

      const file_path = result.secure_url;

      // Get the number of pages (only works for PDFs)
      let pages = 1;
      if (result.format === "pdf") {
        const pdfInfo = await cloudinary.api.resource(result.public_id, {
          pages: true,
        });
        pages = pdfInfo.pages || 1;
      }

      // Calculate total cost (implement your pricing logic here)
      const total_cost = calculateCost(pages);

      const printJob = new PrintJob({
        customer_id: req.user.id,
        print_job_title,
        print_job_description,
        file_path,
        pages,
        total_cost,
      });

      await printJob.save();

      res
        .status(201)
        .json({ message: "Print job created successfully", printJob });
    } catch (err) {
      console.error(err.message);
      // If there's an error, try to delete the uploaded file
      if (req.file) {
        await unlinkFile(req.file.path).catch((unlinkError) =>
          console.error("Failed to delete file:", unlinkError),
        );
      }
      res.status(500).json({ message: "Server error", err: err.message });
    }
  },
);

// 2. Select print agent and update print job
router.post(
  "/select-print-agent/:jobId",
  verifyToken("customer"),
  async (req, res) => {
    try {
      const { print_agent_id } = req.body;
      const printJob = await PrintJob.findById(req.params.jobId);

      if (!printJob) {
        return res.status(404).json({ message: "Print job not found" });
      }

      printJob.print_agent_id = print_agent_id;
      await printJob.save();

      res
        .status(200)
        .json({ message: "Print agent selected successfully", printJob });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ message: "Server error", err });
    }
  },
);

// 3. Initiate payment
router.post(
  "/initiate-payment/:jobId",
  verifyToken("customer"),
  async (req, res) => {
    try {
      const { card_id } = req.body;
      const printJob = await PrintJob.findById(req.params.jobId);
      const customer = await Customer.findById(req.user.id);

      if (!printJob) {
        return res.status(404).json({ message: "Print job not found" });
      }

      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      // Ensure the customer has a Stripe customer ID
      let stripeCustomerId = customer.stripe_customer_id;
      if (!stripeCustomerId) {
        const stripeCustomer = await stripe.customers.create({
          email: customer.email,
          name: customer.full_name,
        });
        stripeCustomerId = stripeCustomer.id;
        customer.stripe_customer_id = stripeCustomerId;
        await customer.save();
      }

      // Create a PaymentIntent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(printJob.total_cost * 100), // Stripe uses cents
        currency: "usd",
        customer: stripeCustomerId,
        payment_method: card_id,
        confirm: true,
        description: `Payment for Print Job: ${printJob.print_job_title}`,
        metadata: {
          print_job_id: printJob._id.toString(),
          customer_id: customer._id.toString(),
        },
      });

      if (paymentIntent.status === "succeeded") {
        printJob.payment_status = "completed";

        const confirmationCode = otpGenerator.generate(6, {
          digits: true,
          alphabets: true,
          upperCase: true,
          specialChars: false,
        });
        printJob.confirmation_code = confirmationCode;
        await printJob.save();

        // INFO: add these later
        // Send confirmation emails
        // await sendCustomerConfirmationEmail(printJob);
        // await sendPrintAgentNotificationEmail(printJob);

        res.status(200).json({
          message: "Payment successful",
          confirmationCode,
          payment_intent: paymentIntent.id,
        });
      } else {
        res.status(400).json({
          message: "Payment not successful",
          status: paymentIntent.status,
        });
      }
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ message: "Server error", err: err.message });
    }
  },
);

// 4. Complete print job
router.post(
  "/complete-print-job/:jobId",
  verifyToken("printAgent"),
  async (req, res) => {
    try {
      const { confirmation_code } = req.body;
      const printJob = await PrintJob.findById(req.params.jobId);

      if (!printJob) {
        return res.status(404).json({ message: "Print job not found" });
      }

      if (printJob.confirmation_code !== confirmation_code) {
        return res.status(400).json({ message: "Invalid confirmation code" });
      }

      printJob.status = "completed";
      await printJob.save();

      res
        .status(200)
        .json({ message: "Print job completed successfully", printJob });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ message: "Server error", err });
    }
  },
);

module.exports = router;
