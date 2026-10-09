const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { upload } = require("../config/mediaUpload");
const { uploadImage } = require("../controllers/uploadController");

const router = express.Router();

router.post("/", protect, upload.single("image"), uploadImage);

module.exports = router;
