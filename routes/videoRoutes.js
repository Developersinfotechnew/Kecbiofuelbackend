const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { upload } = require("../config/multer");
const {
  getPublicVideos,
  getVideoBySlug,
  getAllVideosAdmin,
  getVideoByIdAdmin,
  createVideo,
  updateVideo,
  setVideoStatus,
  deleteVideo,
} = require("../controllers/videoController");

const router = express.Router();

// ---------- Public routes (consumed by the KEC Biofuel website) ----------
router.get("/", getPublicVideos);
router.get("/slug/:slug", getVideoBySlug);

// ---------- Admin routes (consumed by the admin panel) ----------
router.get("/admin/all", protect, getAllVideosAdmin);
router.get("/admin/:id", protect, getVideoByIdAdmin);

router.post("/", protect, upload.single("thumbnail"), createVideo);
router.put("/:id", protect, upload.single("thumbnail"), updateVideo);
router.patch("/:id/status", protect, setVideoStatus);
router.delete("/:id", protect, deleteVideo);

module.exports = router;
