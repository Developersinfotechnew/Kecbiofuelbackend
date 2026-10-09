const crypto = require("crypto");
const asyncHandler = require("express-async-handler");
const Webinar = require("../models/Webinar");
const WebinarBooking = require("../models/WebinarBooking");

const HOLD_MINUTES = 15; // pending bookings hold a seat this long

// ---------- helpers ----------
const PUBLIC_FIELDS = "-meetingLink -createdBy -__v";

async function seatsTaken(webinarId) {
  const holdSince = new Date(Date.now() - HOLD_MINUTES * 60 * 1000);
  return WebinarBooking.countDocuments({
    webinar: webinarId,
    $or: [{ status: { $in: ["paid", "free"] } }, { status: "pending", createdAt: { $gte: holdSince } }],
  });
}

async function withAvailability(w) {
  const obj = w.toObject ? w.toObject() : w;
  const taken = await seatsTaken(obj._id);
  obj.seatsLeft = obj.capacity > 0 ? Math.max(obj.capacity - taken, 0) : null; // null = unlimited
  obj.isFull = obj.capacity > 0 && taken >= obj.capacity;
  return obj;
}

// TEST MODE: when Razorpay keys are missing AND NODE_ENV is not "production",
// payments are simulated (no money, no gateway). Add real keys to .env to switch
// to real Razorpay automatically. In production, mock mode is always OFF.
const hasKeys = () => !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
const isMock = () => !hasKeys() && process.env.NODE_ENV !== "production";

async function razorpayRequest(path, body) {
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) throw new Error("Payment gateway is not configured");
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic " + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64"),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.description || "Payment gateway error");
  return data;
}

function pickWebinarFields(b) {
  const out = {};
  ["title", "slug", "description", "host", "bannerUrl", "meetingLink", "meetingPlatform", "status"].forEach((f) => {
    if (b[f] !== undefined) out[f] = b[f];
  });
  if (b.startsAt !== undefined) out.startsAt = new Date(b.startsAt);
  if (b.durationMins !== undefined) out.durationMins = Number(b.durationMins) || 60;
  if (b.price !== undefined) out.price = Math.max(Number(b.price) || 0, 0);
  if (b.capacity !== undefined) out.capacity = Math.max(parseInt(b.capacity, 10) || 0, 0);
  return out;
}

// ================= PUBLIC =================

// GET /api/webinars?from=ISO&to=ISO   (published, non-cancelled; default: upcoming)
const getPublicWebinars = asyncHandler(async (req, res) => {
  const q = { status: "published" };
  const from = req.query.from ? new Date(req.query.from) : new Date();
  q.startsAt = { $gte: from };
  if (req.query.to) q.startsAt.$lte = new Date(req.query.to);

  const list = await Webinar.find(q).select(PUBLIC_FIELDS).sort("startsAt").limit(200);
  const data = await Promise.all(list.map(withAvailability));
  res.json({ success: true, count: data.length, data });
});

// GET /api/webinars/slug/:slug
const getWebinarBySlug = asyncHandler(async (req, res) => {
  const w = await Webinar.findOne({ slug: req.params.slug, status: "published" }).select(PUBLIC_FIELDS);
  if (!w) {
    res.status(404);
    throw new Error("Webinar not found");
  }
  res.json({ success: true, data: await withAvailability(w) });
});

// POST /api/webinars/:id/book  { name, email, phone, organization }
// Free webinar -> confirmed immediately. Paid -> returns a Razorpay order.
const createBooking = asyncHandler(async (req, res) => {
  const w = await Webinar.findOne({ _id: req.params.id, status: "published" });
  if (!w) {
    res.status(404);
    throw new Error("Webinar not found");
  }
  if (w.startsAt.getTime() <= Date.now()) {
    res.status(400);
    throw new Error("This webinar has already started");
  }

  const { name, email, phone, organization } = req.body;
  if (!name || !email || !phone) {
    res.status(400);
    throw new Error("name, email and phone are required");
  }

  const already = await WebinarBooking.findOne({
    webinar: w._id,
    email: String(email).toLowerCase().trim(),
    status: { $in: ["paid", "free"] },
  });
  if (already) {
    res.status(409);
    throw new Error("This email is already registered for this webinar");
  }

  if (w.capacity > 0 && (await seatsTaken(w._id)) >= w.capacity) {
    res.status(409);
    throw new Error("Sorry, this webinar is full");
  }

  const booking = await WebinarBooking.create({
    webinar: w._id,
    name,
    email,
    phone,
    organization,
    amount: w.price,
    status: w.price > 0 ? "pending" : "free",
  });

  if (w.price <= 0) {
    return res.status(201).json({
      success: true,
      free: true,
      data: { bookingId: booking._id, meetingLink: w.meetingLink, startsAt: w.startsAt, title: w.title },
    });
  }

  if (isMock()) {
    const orderId = `order_TEST_${Date.now()}`;
    booking.razorpayOrderId = orderId;
    await booking.save();
    return res.status(201).json({
      success: true,
      free: false,
      data: { mock: true, bookingId: booking._id, orderId, amount: Math.round(w.price * 100), currency: "INR", webinarTitle: w.title },
    });
  }

  try {
    const order = await razorpayRequest("/orders", {
      amount: Math.round(w.price * 100), // paise
      currency: "INR",
      receipt: `wb_${booking._id}`.slice(0, 40),
      notes: { webinar: w.title, bookingId: String(booking._id) },
    });
    booking.razorpayOrderId = order.id;
    await booking.save();

    res.status(201).json({
      success: true,
      free: false,
      data: {
        bookingId: booking._id,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        webinarTitle: w.title,
      },
    });
  } catch (err) {
    booking.status = "failed";
    await booking.save();
    res.status(502);
    throw err;
  }
});

// POST /api/webinars/verify-payment  { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature }
const verifyPayment = asyncHandler(async (req, res) => {
  const { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const booking = await WebinarBooking.findById(bookingId).populate("webinar");
  if (!booking || booking.razorpayOrderId !== razorpay_order_id) {
    res.status(404);
    throw new Error("Booking not found");
  }
  if (booking.status === "paid") {
    return res.json({ success: true, data: confirmation(booking) });
  }

  if (isMock() && String(razorpay_order_id).startsWith("order_TEST_")) {
    booking.status = "paid";
    booking.razorpayPaymentId = razorpay_payment_id || `pay_TEST_${Date.now()}`;
    booking.paidAt = new Date();
    await booking.save();
    return res.json({ success: true, data: confirmation(booking) });
  }

  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(String(razorpay_signature || ""));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    booking.status = "failed";
    await booking.save();
    res.status(400);
    throw new Error("Payment verification failed");
  }

  booking.status = "paid";
  booking.razorpayPaymentId = razorpay_payment_id;
  booking.razorpaySignature = razorpay_signature;
  booking.paidAt = new Date();
  await booking.save();

  res.json({ success: true, data: confirmation(booking) });
});

function confirmation(booking) {
  const w = booking.webinar;
  return {
    bookingId: booking._id,
    title: w.title,
    startsAt: w.startsAt,
    durationMins: w.durationMins,
    meetingLink: w.meetingLink,
    meetingPlatform: w.meetingPlatform,
  };
}

// POST /api/webinars/razorpay-webhook  (optional safety net if the user closes the tab after paying)
// Configure in Razorpay dashboard with event "payment.captured" + RAZORPAY_WEBHOOK_SECRET.
// Server must mount express.raw() for this path BEFORE express.json() (see README snippet).
const razorpayWebhook = asyncHandler(async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const raw = req.body; // Buffer
  const sig = req.headers["x-razorpay-signature"];
  if (!secret || !sig || !Buffer.isBuffer(raw)) return res.status(400).end();

  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  if (expected !== sig) return res.status(400).end();

  const event = JSON.parse(raw.toString("utf8"));
  if (event.event === "payment.captured") {
    const p = event.payload.payment.entity;
    await WebinarBooking.findOneAndUpdate(
      { razorpayOrderId: p.order_id, status: { $ne: "paid" } },
      { status: "paid", razorpayPaymentId: p.id, paidAt: new Date() }
    );
  }
  res.json({ received: true });
});

// ================= ADMIN =================

const getAllWebinarsAdmin = asyncHandler(async (req, res) => {
  const list = await Webinar.find().sort("-startsAt").limit(300);
  const data = await Promise.all(
    list.map(async (w) => {
      const obj = w.toObject();
      const [paid, revenueAgg] = await Promise.all([
        WebinarBooking.countDocuments({ webinar: w._id, status: { $in: ["paid", "free"] } }),
        WebinarBooking.aggregate([
          { $match: { webinar: w._id, status: "paid" } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
      ]);
      obj.bookingsCount = paid;
      obj.revenue = revenueAgg[0]?.total || 0;
      return obj;
    })
  );
  res.json({ success: true, count: data.length, data });
});

const getWebinarByIdAdmin = asyncHandler(async (req, res) => {
  const w = await Webinar.findById(req.params.id);
  if (!w) {
    res.status(404);
    throw new Error("Webinar not found");
  }
  res.json({ success: true, data: w });
});

const createWebinar = asyncHandler(async (req, res) => {
  const fields = pickWebinarFields(req.body);
  if (!fields.title || !fields.startsAt || Number.isNaN(fields.startsAt.getTime())) {
    res.status(400);
    throw new Error("title and a valid startsAt are required");
  }
  const w = await Webinar.create({ ...fields, createdBy: req.admin._id });
  res.status(201).json({ success: true, data: w });
});

const updateWebinar = asyncHandler(async (req, res) => {
  const w = await Webinar.findById(req.params.id);
  if (!w) {
    res.status(404);
    throw new Error("Webinar not found");
  }
  Object.assign(w, pickWebinarFields(req.body));
  res.json({ success: true, data: await w.save() });
});

const setWebinarStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["draft", "published", "cancelled"].includes(status)) {
    res.status(400);
    throw new Error("Invalid status");
  }
  const w = await Webinar.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!w) {
    res.status(404);
    throw new Error("Webinar not found");
  }
  res.json({ success: true, data: w });
});

const deleteWebinar = asyncHandler(async (req, res) => {
  const w = await Webinar.findById(req.params.id);
  if (!w) {
    res.status(404);
    throw new Error("Webinar not found");
  }
  const hasPaid = await WebinarBooking.exists({ webinar: w._id, status: { $in: ["paid", "free"] } });
  if (hasPaid) {
    res.status(409);
    throw new Error("Webinar has registrations. Cancel it instead of deleting.");
  }
  await WebinarBooking.deleteMany({ webinar: w._id });
  await w.deleteOne();
  res.json({ success: true, data: { _id: req.params.id } });
});

// GET /api/webinars/admin/:id/bookings?status=all|paid|free|pending|failed  (default: confirmed = paid+free)
const getWebinarBookings = asyncHandler(async (req, res) => {
  const webinar = await Webinar.findById(req.params.id);
  if (!webinar) {
    res.status(404);
    throw new Error("Webinar not found");
  }
  const st = req.query.status;
  const filter = { webinar: webinar._id };
  if (!st || st === "confirmed") filter.status = { $in: ["paid", "free"] };
  else if (st !== "all") filter.status = st;

  const [data, all] = await Promise.all([
    WebinarBooking.find(filter).sort("-createdAt"),
    WebinarBooking.find({ webinar: webinar._id }).select("status amount"),
  ]);
  const stats = {
    confirmed: all.filter((b) => ["paid", "free"].includes(b.status)).length,
    pending: all.filter((b) => b.status === "pending").length,
    failed: all.filter((b) => b.status === "failed").length,
    revenue: all.filter((b) => b.status === "paid").reduce((t, b) => t + b.amount, 0),
  };
  res.json({ success: true, count: data.length, stats, webinar, data });
});

// GET /api/webinars/admin/bookings/all?status=&webinar=&search=   (every booking, all webinars)
const getAllBookingsAdmin = asyncHandler(async (req, res) => {
  const filter = {};
  const st = req.query.status;
  if (!st || st === "confirmed") filter.status = { $in: ["paid", "free"] };
  else if (st !== "all") filter.status = st;
  if (req.query.webinar) filter.webinar = req.query.webinar;
  if (req.query.search) {
    const rx = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }
  const data = await WebinarBooking.find(filter).populate("webinar", "title startsAt slug").sort("-createdAt").limit(500);
  res.json({ success: true, count: data.length, data });
});

module.exports = {
  getPublicWebinars,
  getWebinarBySlug,
  createBooking,
  verifyPayment,
  razorpayWebhook,
  getAllWebinarsAdmin,
  getWebinarByIdAdmin,
  createWebinar,
  updateWebinar,
  setWebinarStatus,
  deleteWebinar,
  getWebinarBookings,
  getAllBookingsAdmin,
};
