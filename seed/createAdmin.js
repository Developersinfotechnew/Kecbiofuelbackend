require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Admin = require("../models/Admin");

/**
 * Creates a default admin account from DEFAULT_ADMIN_* env vars, if one
 * with that email doesn't already exist. Run with: npm run seed:admin
 */
(async () => {
  await connectDB();

  const name = process.env.DEFAULT_ADMIN_NAME || "Admin";
  const email = (process.env.DEFAULT_ADMIN_EMAIL || "admin@kecbiofuel.com").toLowerCase();
  const password = process.env.DEFAULT_ADMIN_PASSWORD || "ChangeMe123!";

  const existing = await Admin.findOne({ email });

  if (existing) {
    console.log(`Admin with email "${email}" already exists. Nothing to do.`);
  } else {
    await Admin.create({ name, email, password, role: "superadmin" });
    console.log("Default admin created:");
    console.log(`  email:    ${email}`);
    console.log(`  password: ${password}`);
    console.log("Log in and change this password / create additional admins.");
  }

  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error("Failed to seed admin:", err.message);
  process.exit(1);
});
