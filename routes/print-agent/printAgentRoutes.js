const express = require("express");
const router = express.Router();

router.get("/", (_req, res) => {
  res.send("printAgent Route hit.");
});

module.exports = router;
