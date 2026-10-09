const path = require("path");
const fs = require("fs");
const multer = require("multer");

// Thumbnails are stored on disk under /uploads/thumbnails and served
// statically by server.js at /uploads/thumbnails/<filename>.
const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "thumbnails");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `thumb-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPG, PNG, WEBP or GIF images are allowed for thumbnails"), false);
  }
};

const maxSizeMB = Number(process.env.MAX_UPLOAD_MB) || 5;

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: maxSizeMB * 1024 * 1024 },
});

module.exports = { upload, UPLOAD_DIR };
