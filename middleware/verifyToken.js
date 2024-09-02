const jwt = require("jsonwebtoken");

const verifyToken = (requiredRole) => {
  return (req, res, next) => {
    const authHeader = req.header("Authorization");
    if (!authHeader) {
      console.log("No Authorization header provided");
      return res
        .status(401)
        .json({ message: "No token, authorization denied" });
    }

    const token = authHeader.split(" ")[1];
    console.log("Extracted token:", token);

    if (!token) {
      console.log("No token found after splitting Authorization header");
      return res
        .status(401)
        .json({ message: "No token, authorization denied" });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("Decoded token:", decoded);

      req.user = decoded.user;
      console.log("User from token:", req.user);

      if (req.user.role === "admin") {
        console.log("Admin access granted");
        return next();
      }

      if (requiredRole && req.user.role !== requiredRole) {
        console.log(
          `Role check failed. Required role: ${requiredRole}, User role: ${req.user.role}`,
        );
        return res
          .status(403)
          .json({ message: "Access denied, insufficient permissions" });
      }

      next();
    } catch (err) {
      console.error("Token verification failed:", err.message);
      res.status(401).json({ message: "Token is not valid" });
    }
  };
};

module.exports = verifyToken;
