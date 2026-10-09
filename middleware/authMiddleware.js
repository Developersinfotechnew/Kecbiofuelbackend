const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const Admin = require("../models/Admin");

/**
 * Verifies the Bearer token in the Authorization header and attaches the
 * authenticated admin (minus password) to req.admin. Rejects the request
 * with 401 if the token is missing, invalid, expired, or belongs to a
 * deactivated account.
 */
const protect = asyncHandler(async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  if (!token) {
    res.status(401);
    throw new Error("Not authorized, no token provided");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.id);

    if (!admin || !admin.isActive) {
      res.status(401);
      throw new Error("Not authorized, account not found or deactivated");
    }

    req.admin = admin;
    next();
  } catch (error) {
    res.status(401);
    throw new Error("Not authorized, token invalid or expired");
  }
});

/**
 * Restricts a route to specific admin roles, e.g. authorize("superadmin").
 * Must be used after `protect`.
 */
const authorize = (...roles) => (req, res, next) => {
  if (!req.admin || !roles.includes(req.admin.role)) {
    res.status(403);
    throw new Error("Not authorized to perform this action");
  }
  next();
};

module.exports = { protect, authorize };
