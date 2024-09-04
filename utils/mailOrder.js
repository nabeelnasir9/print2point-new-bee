const sendCustomerConfirmationEmail = async (
  customerEmail,
  confirmationCode,
  printJobTitle,
  transporter,
) => {
  const mailOptions = {
    from: "infosynthseer@gmail.com",
    to: customerEmail,
    subject: "Print Job Confirmation",
    text: `Your print job "${printJobTitle}" has been successfully processed. Your confirmation code is: ${confirmationCode}.`,
  };

  return transporter.sendMail(mailOptions);
};
const sendPrintAgentNotificationEmail = async (
  printAgentEmail,
  printJobTitle,
  transporter,
) => {
  const mailOptions = {
    from: "infosynthseer@gmail.com",
    to: printAgentEmail,
    subject: "New Print Job Assigned",
    text: `A new print job titled "${printJobTitle}" has been assigned to you.`,
  };

  return transporter.sendMail(mailOptions);
};
module.exports = {
  sendCustomerConfirmationEmail,
  sendPrintAgentNotificationEmail,
};
