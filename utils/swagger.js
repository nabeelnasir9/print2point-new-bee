const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Backend API",
      version: "1.0.0",
      description: "A template for backend and documentations",
    },
  },
  apis: ["./routes/*.js"],
  schemes: ["http", "https"],
};

module.exports = swaggerOptions;
