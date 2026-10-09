const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

// Same /uploads root the thumbnails already use, so existing static serving
// (app.use("/uploads", express.static(...))) covers these files too.
const MEDIA_DIR = path.join(__dirname, "..", "uploads", "media");
fs.mkdirSync(MEDIA_DIR, { recursive: true });

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, MEDIA_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `${Date.now()}-${crypto.randomBytes(5).toString("hex")}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED.includes(file.mimetype)) return cb(null, true);
    const err = new Error("Only JPG, PNG, WEBP, GIF or AVIF images are allowed");
    err.name = "MulterError"; // routed to a 400 by errorMiddleware
    cb(err);
  },
});

module.exports = { upload, MEDIA_DIR };
