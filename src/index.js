const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const morgan = require("morgan");
const { createServer } = require("http");
const { Server } = require("socket.io");
require("dotenv").config();
const customerRoutes = require("./routes/customer/customerRoutes");
const authRoutes = require("./routes/authRoutes");
const printAgentRoutes = require("./routes/print-agent/printAgentRoutes.js");
const adminRoutes = require("./routes/adminRoutes.js");
const printJobRoutes = require("./routes/printjobRoutes.js");
const kioskRoutes = require("./routes/kioskRoutes.js");
const chatRoutes = require("./routes/chatRoutes.js");
const { initializeChatSocketHandlers } = require("./services/chatService");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const PrintAgent = require("./models/print-agent-schema.js");
const Customer = require("./models/customer-schema.js");
const {
  sendCustomerConfirmationEmail,
  sendPrintAgentNotificationEmail,
} = require("./utils/mailOrder.js");
const transporter = require("./utils/transporter.js");
const PrintJob = require("./models/print-job-schema.js");
const otpGenerator = require("otp-generator");



const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Initialize chat socket handlers
initializeChatSocketHandlers(io);

const port = process.env.PORT || 3000;
app.use(morgan("dev"));

app.post(
  "/api/printjob/stripe-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    let event;

    try {
      // Verify the webhook signature
      const signature = req.headers["stripe-signature"];
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      console.error(`Webhook signature verification failed: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;

        try {
          const printJobId = paymentIntent.metadata.print_job_id;
          const customerId = paymentIntent.metadata.customer_id;

          const customer = await Customer.findById(customerId);
          if (!customer) {
            throw new Error("Customer not found.");
          }
          const printJob = await PrintJob.findById(printJobId);
          if (!printJob) {
            throw new Error("PrintJob not found.");
          }

          // Generate confirmation code and update payment status
          const confirmationCode = otpGenerator.generate(6, {
            digits: true,
            lowerCaseAlphabets: false,
            upperCaseAlphabets: false,
            specialChars: false,
          });

          printJob.confirmation_code = confirmationCode;
          printJob.payment_status = "completed";
          await printJob.save();

          const printAgent = await PrintAgent.findById(printJob.print_agent_id);
          if (!printAgent) {
            throw new Error("PrintAgent not found.");
          }

          // Send email notifications
          const customerEmailPromise = sendCustomerConfirmationEmail(
            paymentIntent.receipt_email,
            customer.full_name,
            confirmationCode,
            printAgent.email,
            printAgent.business_name,
            printJob._id.toString(), // Convert ObjectId to string
            printJob.print_job_title,
            transporter, // Assuming transporter is defined globally or passed here
          );

          const printAgentEmailPromise = sendPrintAgentNotificationEmail(
            printAgent.email,
            printAgent.full_name,
            printJob.print_job_title,
            transporter,
          );

          await Promise.all([customerEmailPromise, printAgentEmailPromise]);

          // Create chat session for customer-agent communication
          try {
            const { createChatSession } = require("./services/chatService");
            await createChatSession(printJob._id, customerId, printJob.print_agent_id);
            console.log("Chat session created for job:", printJob._id);
          } catch (chatError) {
            console.error("Error creating chat session:", chatError.message);
            // Don't fail the payment process if chat creation fails
          }

          console.log("Payment successful, emails sent, chat session created.");
        } catch (err) {
          console.error("Error processing payment success:", err.message);
        }

        break;
      }

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    // Acknowledge receipt of the event
    res.status(200).json({ received: true });
  },
);

app.use(express.json());

app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.get("/", (_req, res) => {
  res.send("Hello World!");
});

app.use("/api/customer", customerRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/print-agent", printAgentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/printjob", printJobRoutes);
app.use("/api/kiosk", kioskRoutes);
app.use("/api/chat", chatRoutes);





mongoose
  .connect(process.env.MONGO_URL)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .then(() => {
    server.listen(port, () => {
      console.log(`Server is running on ${port}`);
      console.log(`Socket.io server is ready for chat connections`);
    });
  })
  .catch((err) => {
    console.log(err);
  });

module.exports = app;
