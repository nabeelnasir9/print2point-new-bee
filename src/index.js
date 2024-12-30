const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const morgan = require("morgan");
require("dotenv").config();
const customerRoutes = require("./routes/customer/customerRoutes");
const authRoutes = require("./routes/authRoutes");
const printAgentRoutes = require("./routes/print-agent/printAgentRoutes.js");
const adminRoutes = require("./routes/adminRoutes.js");
const printJobRoutes = require("./routes/printjobRoutes.js");

const app = express();
const port = process.env.PORT || 5000;
app.use(morgan("dev"));
// app.use(express.json());
// Apply `express.json()` to all routes except `/api/printjob/stripe-webhook`
app.use(
  express.json({
    verify: (req, res, buf) => {
      if (req.originalUrl === "/api/printjob/stripe-webhook") {
        req.rawBody = buf.toString(); // Store raw body as a string
      }
    },
  })
);
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

module.exports = app;
