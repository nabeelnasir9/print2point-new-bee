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
const { sendPushNotification } = require("./utils/pushNotifications.js");



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

          // Send push notifications to customer and print agent
          try {
            const amount = (paymentIntent.amount / 100).toFixed(2);

            await sendPushNotification(customer._id, "customer", {
              title: "Payment successful 🎉",
              body: `Your payment of $${amount} was successful.`,
              data: {
                type: "payment_success",
                print_job_id: printJob._id.toString(),
                amount,
              },
            });

            await sendPushNotification(customer._id, "customer", {
              title: "Job created successfully",
              body: `"${printJob.print_job_title}" ($${amount}) sent to ${printAgent.business_name}. Pickup code: ${confirmationCode}`,
              data: {
                type: "job_created",
                print_job_id: printJob._id.toString(),
                agent_business_name: printAgent.business_name,
                amount,
                confirmation_code: confirmationCode,
              },
            });

            await sendPushNotification(printAgent._id, "printAgent", {
              title: "New Job received",
              body: `New order "${printJob.print_job_title}" ($${amount}) is ready to print.`,
              data: {
                type: "new_paid_order",
                print_job_id: printJob._id.toString(),
                amount,
              },
            });
          } catch (notifyError) {
            console.error(
              "Error sending payment success notifications:",
              notifyError.message,
            );
            // Don't fail the payment flow if notifications fail
          }

          console.log("Payment successful, emails sent, chat session created.");
        } catch (err) {
          console.error("Error processing payment success:", err.message);
        }

        break;
      }

      // TODO: Enable once "payment_intent.payment_failed" is added in the
      // Stripe Dashboard webhook events. Sends a "Payment failed" push to the
      // customer. Commented out for now.
      // case "payment_intent.payment_failed": {
      //   const paymentIntent = event.data.object;
      //
      //   try {
      //     const customerId = paymentIntent.metadata.customer_id;
      //     const printJobId = paymentIntent.metadata.print_job_id;
      //
      //     if (customerId) {
      //       const printJob = printJobId
      //         ? await PrintJob.findById(printJobId)
      //         : null;
      //       const jobTitle = printJob ? printJob.print_job_title : "your order";
      //
      //       await sendPushNotification(customerId, "customer", {
      //         title: "Payment failed ❌",
      //         body: `Your payment for "${jobTitle}" could not be completed. Please try again.`,
      //         data: {
      //           type: "payment_failed",
      //           print_job_id: printJobId || "",
      //         },
      //       });
      //     }
      //
      //     console.log("Payment failed notification sent.");
      //   } catch (err) {
      //     console.error("Error processing payment failure:", err.message);
      //   }
      //
      //   break;
      // }

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
app.use("/api/banner", require("./routes/bannerRoutes.js"));
app.use("/api/notifications", require("./routes/notificationRoutes.js"));





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
