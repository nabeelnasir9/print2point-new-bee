const express = require("express");
const router = express.Router();
/**
 * @swagger
 * /test:
 *   get:
 *     description: Testing API route
 *     responses:
 *       "200":
 *         description: API is working
 *       "404":
 *         description: API is not working
 */

router.get("/", (_req, res) => {
  res.send("API is working");
});

module.exports = router;
