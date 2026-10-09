const asyncHandler = require("express-async-handler");
const Admin = require("../models/Admin");
const generateToken = require("../utils/generateToken");

// @desc    Register a new admin account
// @route   POST /api/auth/register
// @access  Public, but requires a valid ADMIN_SETUP_KEY in the request body.
//          Intended for bootstrapping the first admin(s) of the panel;
//          you can stop exposing/rotate the setup key once accounts exist.
const registerAdmin = asyncHandler(async (req, res) => {
  const { name, email, password, setupKey } = req.body;

  if (!setupKey || setupKey !== process.env.ADMIN_SETUP_KEY) {
    res.status(401);
    throw new Error("Invalid or missing setup key");
  }

  if (!name || !email || !password) {
    res.status(400);
    throw new Error("Name, email and password are required");
  }

  const existing = await Admin.findOne({ email: email.toLowerCase() });
  if (existing) {
    res.status(409);
    throw new Error("An admin with this email already exists");
  }

  const admin = await Admin.create({ name, email, password });

  res.status(201).json({
    success: true,
    data: {
      _id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
    },
    token: generateToken(admin._id),
  });
});

// @desc    Log an admin in
// @route   POST /api/auth/login
// @access  Public
const loginAdmin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error("Email and password are required");
  }

  const admin = await Admin.findOne({ email: email.toLowerCase() }).select("+password");

  if (!admin || !admin.isActive || !(await admin.matchPassword(password))) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  res.json({
    success: true,
    data: {
      _id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
    },
    token: generateToken(admin._id),
  });
});

// @desc    Get the currently authenticated admin's profile
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.admin });
});

module.exports = { registerAdmin, loginAdmin, getMe };
