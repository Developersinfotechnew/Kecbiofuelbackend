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

// Allow one or more comma-separated origins (e.g. your admin panel + main site)
const allowedOrigins = (process.env.CLIENT_URL || "").split(",").map((o) => o.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

app.post(
  "/api/webinars/razorpay-webhook",
  express.raw({ type: "application/json" }),
  webinarController.razorpayWebhook
);


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
app.use("/api/webinars", require("./routes/webinarRoutes")); // <-- NEW


app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`);
});
