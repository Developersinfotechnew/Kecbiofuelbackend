const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
  getPublicBlogs,
  getBlogBySlug,
  addView,
  getAllBlogsAdmin,
  getBlogByIdAdmin,
  createBlog,
  updateBlog,
  setBlogStatus,
  deleteBlog,
} = require("../controllers/blogController");

const router = express.Router();

// ---------- Public ----------
router.get("/", getPublicBlogs);
router.get("/slug/:slug", getBlogBySlug);
router.post("/slug/:slug/view", addView);

// ---------- Admin (declared before "/:id" routes on purpose) ----------
router.get("/admin/all", protect, getAllBlogsAdmin);
router.get("/admin/:id", protect, getBlogByIdAdmin);

router.post("/", protect, createBlog);
router.put("/:id", protect, updateBlog);
router.patch("/:id/status", protect, setBlogStatus);
router.delete("/:id", protect, deleteBlog);

module.exports = router;
