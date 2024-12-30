const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const PrintAgent = require("../models/print-agent-schema.js");
const verifyToken = require("../middleware/verifyToken.js");
const calculateCost = require("../utils/calculateCost.js");
const uploadToCloudinary = require("../utils/uploadCloudinary.js");
const {
  sendCustomerConfirmationEmail,
  sendPrintAgentNotificationEmail,
} = require("../utils/mailOrder.js");
const transporter = require("../utils/transporter.js");
const PrintJob = require("../models/print-job-schema.js");
const otpGenerator = require("otp-generator");
const Customer = require("../models/customer-schema.js");
const router = express.Router();
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET; // Webhook secret for verification

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const upload = multer({ storage: multer.memoryStorage() });

router.post(
  "/create-print-job",
  verifyToken("customer"),
  upload.single("file"),
  async (req, res) => {
    try {
      let { print_job_title, print_job_description, is_color, no_of_copies } =
        req.body;

      is_color = is_color === "true";

      if (typeof is_color !== "boolean") {
        return res
          .status(400)
          .json({ message: "Please define if it is colored or not" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const customer = await Customer.findById(req.user.id);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

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

      const result = await uploadToCloudinary(req.file.buffer);
      const file_path = result.secure_url;
      let pages = 1;

      if (result.format === "pdf") {
        const pdfInfo = await cloudinary.api.resource(result.public_id, {
          pages: true,
        });
        pages = pdfInfo.pages || 1;
      }

      const createdAt = new Date();
      const total_cost = calculateCost(
        pages,
        is_color,
        createdAt,
        no_of_copies,
      );

      const printJob = new PrintJob({
        customer_id: req.user.id,
        print_job_title,
        print_job_description,
        file_path,
        is_color,
        no_of_copies,
        pages,
        total_cost,
        created_at: createdAt,
      });

      await printJob.save();

      res
        .status(201)
        .json({ message: "Print job created successfully", printJob });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ message: "Server error", err: err.message });
    }
  },
);

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

// router.post("/initiate-payment", verifyToken("customer"), async (req, res) => {
//   try {
//     const { payment_method_id, job_id } = req.body;
//     const printJob = await PrintJob.findById(job_id);
//     const customer = await Customer.findById(req.user.id);
//     const printAgent = await PrintAgent.findById(printJob.print_agent_id);

//     if (!printJob) {
//       return res.status(404).json({ message: "Print job not found" });
//     }

//     if (!customer) {
//       return res.status(404).json({ message: "Customer not found" });
//     }

//     if (!printAgent) {
//       return res.status(404).json({ message: "Print agent not found" });
//     }


//     let stripeCustomerId = customer.stripe_customer_id;
//     if (!stripeCustomerId) {
//       const stripeCustomer = await stripe.customers.create({
//         email: customer.email,
//         name: customer.full_name,
//       });
//       stripeCustomerId = stripeCustomer.id;
//       customer.stripe_customer_id = stripeCustomerId;
//       await customer.save();
//     }
//     let paymentIntent;

//     if(printAgent.stripe_account_id){
//        paymentIntent = await stripe.paymentIntents.create({
//         amount: Math.round(printJob.total_cost * 100),
//         currency: "usd",
//         customer: stripeCustomerId,
//         payment_method: payment_method_id,
//         return_url: "http://localhost:5173",
//         setup_future_usage: "off_session",
//         confirm: true,

//         application_fee_amount: Math.floor(Math.round(printJob.total_cost * 100) * 0.25),
//         transfer_data: {
//           destination:printAgent.stripe_account_id,
//         },

//         description: `Payment for Print Job: ${printJob.print_job_title}`,
//         metadata: {
//           print_job_id: printJob._id.toString(),
//           customer_id: customer._id.toString(),
//         },
//       });
//     }else{
//       paymentIntent = await stripe.paymentIntents.create({
//         amount: Math.round(printJob.total_cost * 100),
//         currency: "usd",
//         customer: stripeCustomerId,
//         payment_method: payment_method_id,
//         return_url: "http://localhost:5173",
//         setup_future_usage: "off_session",
//         confirm: true,
//         description: `Payment for Print Job: ${printJob.print_job_title}`,
//         metadata: {
//           print_job_id: printJob._id.toString(),
//           customer_id: customer._id.toString(),
//         },
//       });
//     }



//     if (paymentIntent.status === "succeeded") {
//       // printJob.payment_status = "completed";
//       const confirmationCode = otpGenerator.generate(6, {
//         digits: true,
//         lowerCaseAlphabets: false,
//         upperCaseAlphabets: false,
//         specialChars: false,
//       });
//       printJob.confirmation_code = confirmationCode;
//       printJob.payment_status = "completed";
//       await printJob.save();

//       const customerEmailPromise = sendCustomerConfirmationEmail(
//         customer.email,
//         customer.full_name,
//         confirmationCode,
//         printJob._id,
//         printJob.print_job_title,
//         transporter,
//       );

//       const printAgent = await PrintAgent.findById(printJob.print_agent_id);
//       const printAgentEmailPromise = sendPrintAgentNotificationEmail(
//         printAgent.email,
//         printAgent.full_name,
//         printJob.print_job_title,
//         transporter,
//       );

//       await Promise.all([customerEmailPromise, printAgentEmailPromise]);

//       res.status(200).json({
//         message: "Payment successful and emails sent",
//         confirmationCode,
//         payment_intent: paymentIntent.id,
//       });
//     } else {
//       res.status(400).json({
//         message: "Payment not successful",
//         status: paymentIntent.status,
//       });
//     }
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).json({ message: "Server error", err: err.message });
//   }
// });



// router.post("/initiate-payment", verifyToken("customer"), async (req, res) => {
//   try {
//     const { job_id } = req.body; // Remove payment_method_id as it's not needed for Payment Element
//     const printJob = await PrintJob.findById(job_id);
//     const customer = await Customer.findById(req.user.id);
//     const printAgent = await PrintAgent.findById(printJob.print_agent_id);

//     if (!printJob) {
//       return res.status(404).json({ message: "Print job not found" });
//     }

//     if (!customer) {
//       return res.status(404).json({ message: "Customer not found" });
//     }

//     if (!printAgent) {
//       return res.status(404).json({ message: "Print agent not found" });
//     }

//     let stripeCustomerId = customer.stripe_customer_id;
//     if (!stripeCustomerId) {
//       const stripeCustomer = await stripe.customers.create({
//         email: customer.email,
//         name: customer.full_name,
//       });
//       stripeCustomerId = stripeCustomer.id;
//       customer.stripe_customer_id = stripeCustomerId;
//       await customer.save();
//     }

//     // Create Payment Intent
//     let paymentIntent;
//     if (printAgent.stripe_account_id) {
//       let stripePercentage = 0.25;
//       if (printAgent.percentage) {
//         stripePercentage = printAgent.percentage / 100;
//       }

//       paymentIntent = await stripe.paymentIntents.create({
//         amount: Math.round(printJob.total_cost * 100),
//         currency: "usd",
//         customer: stripeCustomerId,
//         setup_future_usage: "off_session",
//         application_fee_amount: Math.floor(Math.round(printJob.total_cost * 100) * stripePercentage),
//         transfer_data: {
//           destination: printAgent.stripe_account_id,
//         },
//         description: `Payment for Print Job: ${printJob.print_job_title}`,
//         metadata: {
//           print_job_id: printJob._id.toString(),
//           customer_id: customer._id.toString(),
//         },
//       });
//     } else {
//       paymentIntent = await stripe.paymentIntents.create({
//         amount: Math.round(printJob.total_cost * 100),
//         currency: "usd",
//         customer: stripeCustomerId,
//         setup_future_usage: "off_session",
//         description: `Payment for Print Job: ${printJob.print_job_title}`,
//         metadata: {
//           print_job_id: printJob._id.toString(),
//           customer_id: customer._id.toString(),
//         },
//       });
//     }

//     // Respond with client secret for the Payment Element to confirm payment
//     res.status(200).json({
//       message: "Payment intent created successfully",
//       clientSecret: paymentIntent.client_secret,
//     });
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).json({ message: "Server error", err: err.message });
//   }
// });








// Endpoint to get saved payment methods for a customer
router.get("/get-saved-payment-methods", verifyToken("customer"), async (req, res) => {
  try {
    const customer = await Customer.findById(req.user.id);
    if (!customer || !customer.stripe_customer_id) {
      return res.status(404).json({ message: "Customer or Stripe customer ID not found" });
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: customer.stripe_customer_id,
      type: 'card', // Only fetch cards
    });

    res.status(200).json({
      paymentMethods: paymentMethods.data,
    });
  } catch (err) {
    console.error("Error fetching payment methods", err);
    res.status(500).json({ message: "Failed to fetch payment methods", err: err.message });
  }
});


// Endpoint to save payment method for a customer
router.post("/save-payment-method", verifyToken("customer"), async (req, res) => {
  try {
    const { paymentMethodId } = req.body;
    const customer = await Customer.findById(req.user.id);

    if (!customer || !customer.stripe_customer_id) {
      return res.status(404).json({ message: "Customer or Stripe customer ID not found" });
    }

    // Attach the payment method to the customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customer.stripe_customer_id,
    });

    // Optionally, make this payment method the default for future payments
    await stripe.customers.update(customer.stripe_customer_id, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    res.status(200).json({ message: "Payment method saved successfully" });
  } catch (err) {
    console.error("Error saving payment method", err);
    res.status(500).json({ message: "Failed to save payment method", err: err.message });
  }
});

// router.post("/initiate-payment", verifyToken("customer"), async (req, res) => {
//   try {
//     const { job_id } = req.body;
//     const printJob = await PrintJob.findById(job_id);
//     const customer = await Customer.findById(req.user.id);
//     const printAgent = await PrintAgent.findById(printJob.print_agent_id);

//     if (!printJob) {
//       return res.status(404).json({ message: "Print job not found" });
//     }

//     if (!customer) {
//       return res.status(404).json({ message: "Customer not found" });
//     }

//     if (!printAgent) {
//       return res.status(404).json({ message: "Print agent not found" });
//     }

//     let stripeCustomerId = customer.stripe_customer_id;
//     if (!stripeCustomerId) {
//       const stripeCustomer = await stripe.customers.create({
//         email: customer.email,
//         name: customer.full_name,
//       });
//       stripeCustomerId = stripeCustomer.id;
//       customer.stripe_customer_id = stripeCustomerId;
//       await customer.save();
//     }

//     // Retrieve the existing PaymentIntent if it exists and check its status
//     let paymentIntent;
//     if (customer.latest_payment_intent_id) {
//       paymentIntent = await stripe.paymentIntents.retrieve(customer.latest_payment_intent_id);

//       // If the PaymentIntent has already succeeded, skip confirming it again and just return the existing client secret
//       if (paymentIntent.status === 'succeeded') {
//         return res.status(200).json({
//           message: "Payment has already been completed successfully.",
//           clientSecret: paymentIntent.client_secret, // send the existing client secret
//         });
//       }
//     }

//     // If there's no existing PaymentIntent or it's not succeeded, create a new one
//     if (!paymentIntent || paymentIntent.status !== 'succeeded') {
//       if (printAgent.stripe_account_id) {
//         let stripePercentage = 0.25;
//         if (printAgent.percentage) {
//           stripePercentage = printAgent.percentage / 100;
//         }

//         paymentIntent = await stripe.paymentIntents.create({
//           amount: Math.round(printJob.total_cost * 100),
//           currency: "usd",
//           customer: stripeCustomerId,
//           setup_future_usage: "off_session",
//           application_fee_amount: Math.floor(Math.round(printJob.total_cost * 100) * stripePercentage),
//           transfer_data: {
//             destination: printAgent.stripe_account_id,
//           },
//           description: `Payment for Print Job: ${printJob.print_job_title}`,
//           metadata: {
//             print_job_id: printJob._id.toString(),
//             customer_id: customer._id.toString(),
//           },
//         });

//         // Store the PaymentIntent ID for future use
//         customer.latest_payment_intent_id = paymentIntent.id;
//         await customer.save();
//       } else {
//         // Create a fallback PaymentIntent without the print agent
//         paymentIntent = await stripe.paymentIntents.create({
//           automatic_payment_methods: {
//             enabled: true,
//             allow_redirects: 'never',
//           },
//           amount: Math.round(printJob.total_cost * 100),
//           currency: "usd",
//           customer: stripeCustomerId,
//           setup_future_usage: "off_session",
//           description: `Payment for Print Job: ${printJob.print_job_title}`,
//           metadata: {
//             print_job_id: printJob._id.toString(),
//             customer_id: customer._id.toString(),
//           },
//         });

//         // Store the PaymentIntent ID for future use
//         customer.latest_payment_intent_id = paymentIntent.id;
//         await customer.save();
//       }
//     }

//     // Respond with the client secret for the Payment Element to confirm payment
//     res.status(200).json({
//       message: "Payment intent created successfully",
//       clientSecret: paymentIntent.client_secret,
//     });
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).json({ message: "Server error", err: err.message });
//   }
// });


router.post("/initiate-payment", verifyToken("customer"), async (req, res) => {
  try {
    const { job_id } = req.body;

    // Fetch required entities
    const printJob = await PrintJob.findById(job_id);
    const customer = await Customer.findById(req.user.id);
    const printAgent = await PrintAgent.findById(printJob.print_agent_id);

    if (!printJob) return res.status(404).json({ message: "Print job not found" });
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    if (!printAgent) return res.status(404).json({ message: "Print agent not found" });

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

    // Handle existing PaymentIntent logic
    let paymentIntent;
    if (customer.latest_payment_intent_id) {
      paymentIntent = await stripe.paymentIntents.retrieve(customer.latest_payment_intent_id);

      if (paymentIntent.status === 'succeeded') {
        return res.status(200).json({
          message: "Payment already completed",
          clientSecret: paymentIntent.client_secret,
        });
      }
    }

    // Calculate the final amount with discount if a coupon was applied
    const totalCost = Math.round(printJob.total_cost * 100); // Convert to cents for Stripe
    const perAmount = 25;
    if (printAgent.percentage) {
      perAmount = printAgent.percentage;
    }
    if (!paymentIntent || paymentIntent.status !== 'succeeded') {
      paymentIntent = await stripe.paymentIntents.create({
        amount: totalCost,
        currency: "eur",
        customer: stripeCustomerId,
        payment_method_types: ["card", "ideal"],
        setup_future_usage: "off_session",
        application_fee_amount: printAgent.stripe_account_id
          ? Math.floor(totalCost * (perAmount / 100))
          : undefined, // Optional for agents with Stripe account
        transfer_data: printAgent.stripe_account_id
          ? { destination: printAgent.stripe_account_id }
          : undefined,
        description: `Payment for Print Job: ${printJob.print_job_title}`,
        metadata: {
          print_job_id: printJob._id.toString(),
          customer_id: customer._id.toString(),
        },
      });

      customer.latest_payment_intent_id = paymentIntent.id;
      await customer.save();
    }

    res.status(200).json({
      message: "Payment intent created successfully",
      clientSecret: paymentIntent.client_secret,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error", err: err.message });
  }
});


router.post("/apply-coupon", verifyToken("customer"), async (req, res) => {
  try {
    const { job_id, coupon_code } = req.body;

    // Find the PrintJob and validate existence
    const printJob = await PrintJob.findById(job_id);
    if (!printJob) return res.status(404).json({ message: "Print job not found" });

    // Validate the coupon
    const coupon = await stripe.coupons.retrieve(coupon_code);
    if (!coupon || !coupon.valid) {
      return res.status(400).json({ message: "Invalid or expired coupon code" });
    }

    // Calculate discount and new total
    const discountAmount = (printJob.total_cost * coupon.percent_off) / 100;
    const discountedTotal = printJob.total_cost - discountAmount;

    printJob.total_cost = discountedTotal;
    await printJob.save();

    // Update the total only in-memory to avoid overwriting DB unnecessarily
    res.status(200).json({
      message: "Coupon applied successfully",
      newTotalCost: discountedTotal,
      discountAmount,
    });
  } catch (err) {
    console.error("Error applying coupon:", err);
    res.status(500).json({ message: "Failed to apply coupon", err: err.message });
  }
});





// Endpoint to check the status of the PaymentIntent
router.get("/check-payment-intent-status", verifyToken("customer"), async (req, res) => {
  try {
    const { clientSecret } = req.query;

    if (!clientSecret) {
      return res.status(400).json({ message: "clientSecret is required" });
    }

    // Retrieve the PaymentIntent status using the clientSecret
    const paymentIntent = await stripe.paymentIntents.retrieve(clientSecret);

    res.status(200).json({
      status: paymentIntent.status,
    });
  } catch (err) {
    console.error("Error checking PaymentIntent status", err);
    res.status(500).json({ message: "Failed to check PaymentIntent status", err: err.message });
  }
});



router.get("/customer-payment-methods", verifyToken("customer"), async (req, res) => {
  try {
    const customer = await Customer.findById(req.user.id);

    if (!customer || !customer.stripe_customer_id) {
      return res.status(404).json({ message: "Customer or Stripe customer ID not found" });
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: customer.stripe_customer_id,
      type: 'card', // Only fetch card payment methods
    });

    // Return the list of saved payment methods
    res.status(200).json({
      paymentMethods: paymentMethods.data,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error", err: err.message });
  }
});





router.post(
  "/complete-print-job",
  verifyToken("printAgent"),
  async (req, res) => {
    try {
      const { confirmation_code } = req.body;

      const printJob = await PrintJob.findOne({ confirmation_code });

      if (!printJob) {
        return res.status(404).json({ message: "Print job not found" });
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



// Webhook endpoint
router.post("/stripe-webhook", express.raw({ type: "application/json" }), async (req, res) => {
  let event;

  try {
    // Verify the webhook signature
    const signature = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(req.body, signature, endpointSecret);
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object;

      try {
        // Retrieve PrintJob and Customer details
        const printJobId = paymentIntent.metadata.print_job_id;
        const customerId = paymentIntent.metadata.customer_id;

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

        // Send email notifications
        const customerEmailPromise = sendCustomerConfirmationEmail(
          paymentIntent.receipt_email,
          paymentIntent.metadata.customer_name,
          confirmationCode,
          printJob._id,
          printJob.print_job_title,
          transporter
        );

        const printAgent = await PrintAgent.findById(printJob.print_agent_id);
        const printAgentEmailPromise = sendPrintAgentNotificationEmail(
          printAgent.email,
          printAgent.full_name,
          printJob.print_job_title,
          transporter
        );

        await Promise.all([customerEmailPromise, printAgentEmailPromise]);

        console.log("Payment successful, emails sent.");
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
});


module.exports = router;
