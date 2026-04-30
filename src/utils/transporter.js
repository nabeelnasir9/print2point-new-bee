const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "mail-eu.smtp2go.com",
  port: 2525,
  secure: false,
  auth: {
    user: process.env.SMTP2GO_USER,
    pass: process.env.SMTP2GO_API_KEY,
  },
});

module.exports = transporter;
