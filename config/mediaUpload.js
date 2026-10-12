const multer = require("multer");

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

// Keep file in memory only. Controller streams it to Cloudinary.
// Nothing is written to local disk, so nothing is lost on redeploy.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED.includes(file.mimetype)) return cb(null, true);
    const err = new Error("Only JPG, PNG, WEBP, GIF or AVIF images are allowed");
    err.name = "MulterError"; // routed to a 400 by errorMiddleware
    cb(err);
  },
});

module.exports = { upload };
