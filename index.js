const express = require("express");
// const mongoose = require("mongoose");
require("dotenv").config();
const morgan = require("morgan");
const { swaggerOptions } = require("./utils/swagger");
const swaggerUi = require("swagger-ui-express");
const swaggerJSDoc = require("swagger-jsdoc");
const TestRoutes = require("./routes/TestRoutes");

const app = express();
const port = process.env.PORT || 5000;
const swaggerDocument = swaggerJSDoc(swaggerOptions);

app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/test/", TestRoutes);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
// mongoose
//   .connect(process.env.MONGO_URL, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
//   })
//   .then(() => {
//     app.listen(serverPort, () => {
//       console.log(`Server is running on ${serverPort}`);
//     });
//   })
//   .catch((err) => {
//     console.log(err);
//   });

app.listen(3000, () => {
  console.log(`Server is running on port ${port}`);
});
