const mailOptions = (email, otp) => {
  return {
    from: process.env.EMAIL,
    to: email,
    subject: "Verify your email",
    // write simple html just saying this is otp for availability switch for print agent
    html: `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Print to Point</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 0;
          background-color: #f4f4f6;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #ffffff;
          border: 1px solid #dddddd;
          border-radius: 8px;
        }
        h1 {
          color: #f7801a;
          font-size: 24px;
          margin-bottom: 10px;
        }
        p {
          color: #333333;
          font-size: 16px;
          line-height: 1.5;
        }
        .otp {
          font-weight: bold;
          color: #ffffff;
          background-color: #f7801a;
          padding: 10px;
          border-radius: 4px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Print to Point</h1>
        <p>
          update your availability
        </p>
        <p class="otp">This is your OTP: ${otp}</p>
      </div>
    </body>
  </html>
`,
  };
};

module.exports = mailOptions;
