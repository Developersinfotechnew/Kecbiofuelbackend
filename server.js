require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const videoRoutes = require("./routes/videoRoutes");
const webinarController = require("./controllers/webinarController");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

connectDB();

const app = express();

// Render sits behind a proxy. Needed for secure cookies.
app.set("trust proxy", 1);

// Allow one or more comma-separated origins (e.g. your admin panel + main site)
// Example CLIENT_URL=https://kecbiofuelfrontend-pi.vercel.app,https://kecbiofuel.com
const allowedOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, "")) // strip spaces + trailing slash
  .filter(Boolean); // drop empty entries

const corsOptions = {
  origin: (origin, callback) => {
    // No origin = curl, Postman, server-to-server, webhooks
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
      return callback(null, true);
    }
    console.warn("CORS blocked origin:", origin, "| allowed:", allowedOrigins);
    return callback(null, false); // no throw, so no 500 without CORS headers
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // explicit preflight handling

if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// Razorpay webhook needs the RAW body for signature check.
// Must come BEFORE express.json(), or the body is already parsed and raw() does nothing.
app.post(
  "/api/webinars/razorpay-webhook",
  express.raw({ type: "application/json" }),
  webinarController.razorpayWebhook
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve uploaded thumbnails statically, e.g. GET /uploads/thumbnails/thumb-xxx.jpg
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "KEC Biofuel API is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/videos", videoRoutes);

app.use("/api/blogs", require("./routes/blogRoutes"));
app.use("/api/projects", require("./routes/projectRoutes"));
app.use("/api/uploads", require("./routes/uploadRoutes"));
app.use("/api/webinars", require("./routes/webinarRoutes"));

app.get("/", (req, res) => {
  res.json({ success: true, message: "KEC Biofuel API. See /api/health" });
});

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`);
  console.log("Allowed CORS origins:", allowedOrigins);
});