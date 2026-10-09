const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    webinar: { type: mongoose.Schema.Types.ObjectId, ref: "Webinar", required: true, index: true },
    name: { type: String, required: [true, "Name is required"], trim: true },
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    phone: { type: String, required: [true, "Phone is required"], trim: true },
    organization: { type: String, trim: true, default: "" },

    amount: { type: Number, default: 0 }, // rupees
    status: { type: String, enum: ["pending", "paid", "free", "failed"], default: "pending", index: true },

    razorpayOrderId: { type: String, index: true },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("WebinarBooking", bookingSchema);
