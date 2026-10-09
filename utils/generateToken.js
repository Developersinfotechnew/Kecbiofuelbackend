const jwt = require("jsonwebtoken");

/**
 * Signs a JWT embedding the admin's id, used for stateless authentication.
 */
const generateToken = (adminId) => {
  return jwt.sign({ id: adminId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

module.exports = generateToken;
