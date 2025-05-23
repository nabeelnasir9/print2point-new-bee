const agentMailOptions = (email, otp, full_name) => {
  return {
    from: process.env.EMAIL,
    to: email,
    subject: "Verify your email",
    html: `
        <!doctype html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <meta http-equiv="X-UA-Compatible" content="ie=edge" />
            <title>Static Template</title>

            <link
              href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap"
              rel="stylesheet"
            />
          </head>
          <body
            style="
              margin: 0;
              font-family: &quot;Poppins&quot;, sans-serif;
              background: #ffffff;
              font-size: 14px;
            "
          >
            <div
              style="
                max-width: 680px;
                margin: 0 auto;
                padding: 45px 30px 60px;
                background: #f4f7ff;
                background-image: url(https://4xil623tof.ufs.sh/f/14wn9NeEA2nYpIgNcjPbHAXPSfw8IEyWuC6KQMaUcF0VjkBR);
                background-repeat: no-repeat;
                background-size: 800px 452px;
                background-position: top center;
                font-size: 14px;
                color: #434343;
              "
            >
              <header>
                <table style="width: 100%">
                  <tbody>
                    <tr style="height: 0">
                      <td>
                        <img
                          alt=""
                          src="https://4xil623tof.ufs.sh/f/14wn9NeEA2nYqZJwOg6Dof9QtjiKTV8sgxCZOEmrUBe1SpbW"
                          height="70px"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </header>

              <main>
                <div
                  style="
                    margin: 0;
                    margin-top: 70px;
                    padding: 92px 30px 115px;
                    background: #ffffff;
                    border-radius: 30px;
                    text-align: center;
                  "
                >
                  <div style="width: 100%; max-width: 489px; margin: 0 auto">
                    <h1
                      style="
                        margin: 0;
                        font-size: 24px;
                        font-weight: 500;
                        color: #f7801a;
                      "
                    >
                      Verification Code for Print Agents
                    </h1>
                    <p
                      style="
                        margin: 0;
                        margin-top: 17px;
                        font-size: 16px;
                        font-weight: 500;
                      "
                    >
                      Hey ${full_name},
                    </p>
                    <p
                      style="
                        margin: 0;
                        margin-top: 17px;
                        font-weight: 500;
                        letter-spacing: 0.56px;
                      "
                    >
                      Thank you for choosing
                      <span style="color: #f7801a; font-weight: 600"
                        >Print to Point</span
                      >
                      Company. Use the following OTP to complete the procedure of
                      creating an account. OTP is valid for
                      <span style="font-weight: 600; color: #1f1f1f">5 minutes</span>.
                      Do not share this code with others, including Print to Point
                      employees.
                    </p>
                    <p
                      style="
                        margin: 0;
                        margin-top: 60px;
                        font-size: 40px;
                        font-weight: 600;
                        letter-spacing: 25px;
                        color: #f7801a;
                      "
                    >
                      ${otp}
                    </p>
                  </div>
                </div>

                <p
                  style="
                    max-width: 400px;
                    margin: 0 auto;
                    margin-top: 90px;
                    text-align: center;
                    font-weight: 500;
                    color: #8c8c8c;
                  "
                >
                  Need help? Ask at
                  <a
                    href="mailto:info@printtopoint.com"
                    style="color: #f7801a; text-decoration: none"
                    >info@printtopoint.com</a
                  >
                  or visit our
                  <a
                    href=""
                    target="_blank"
                    style="color: #f7801a; text-decoration: none"
                    >Help Center</a
                  >
                </p>
              </main>

              <footer
                style="
                  width: 100%;
                  max-width: 490px;
                  margin: 20px auto 0;
                  text-align: center;
                  border-top: 1px solid #e6ebf1;
                "
              >
                <p
                  style="
                    margin: 0;
                    margin-top: 40px;
                    font-size: 16px;
                    font-weight: 600;
                    color: #434343;
                  "
                >
                  Print to Point Company
                </p>
                <!-- <p style="margin: 0; margin-top: 8px; color: #434343"> -->
                <!--   Address 540, City, State. -->
                <!-- </p> -->
                <p style="margin: 0; margin-top: 16px; color: #434343">
                  Copyright © 2024 Company. All rights reserved.
                </p>
              </footer>
            </div>
          </body>
        </html>
`,
  };
};

module.exports = agentMailOptions;
