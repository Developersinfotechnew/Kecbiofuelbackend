const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const c = require("../controllers/webinarController");

const router = express.Router();

// ---------- Public ----------
router.get("/", c.getPublicWebinars);
router.get("/slug/:slug", c.getWebinarBySlug);
router.post("/verify-payment", c.verifyPayment);
router.post("/:id/book", c.createBooking);

// ---------- Admin ----------
router.get("/admin/all", protect, c.getAllWebinarsAdmin);
router.get("/admin/bookings/all", protect, c.getAllBookingsAdmin);
router.get("/admin/:id", protect, c.getWebinarByIdAdmin);
router.get("/admin/:id/bookings", protect, c.getWebinarBookings);
router.post("/", protect, c.createWebinar);
router.put("/:id", protect, c.updateWebinar);
router.patch("/:id/status", protect, c.setWebinarStatus);
router.delete("/:id", protect, c.deleteWebinar);

module.exports = router;
