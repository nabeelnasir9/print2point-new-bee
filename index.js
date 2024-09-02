require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const express = require("express");
const mongoose = require("mongoose");
const morgan = require("morgan");

const customerRoutes = require("./routes/customer/customerRoutes");
const authRoutes = require("./routes/authRoutes");
const printAgentRoutes = require("./routes/print-agent/printAgentRoutes.js");
const adminRoutes = require("./routes/adminRoutes.js");
const printJobRoutes = require("./routes/printjobRoutes.js");

const app = express();
const port = process.env.PORT || 5000;
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/customer", customerRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/print-agent", printAgentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/printjob", printJobRoutes);

// TODO: CHECK THIS
const paymentMethods = async () => {
  const paymentMethods = await stripe.paymentMethods.list({
    customer: stripeCustomerId, // The customer's Stripe ID
    type: "card",
  });
  return paymentMethods;
};
await paymentMethods();

mongoose
  .connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .then(() => {
    app.listen(port, () => {
      console.log(`Server is running on ${port}`);
    });
  })
  .catch((err) => {
    console.log(err);
  });
