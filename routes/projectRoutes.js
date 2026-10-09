const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
  getPublicProjects,
  getProjectBySlug,
  getAllProjectsAdmin,
  getProjectByIdAdmin,
  createProject,
  updateProject,
  setProjectStatus,
  setProjectSection,
  deleteProject,
} = require("../controllers/projectController");

const router = express.Router();

// ---------- Public ----------
router.get("/", getPublicProjects);
router.get("/slug/:slug", getProjectBySlug);

// ---------- Admin ----------
router.get("/admin/all", protect, getAllProjectsAdmin);
router.get("/admin/:id", protect, getProjectByIdAdmin);

router.post("/", protect, createProject);
router.put("/:id", protect, updateProject);
router.patch("/:id/status", protect, setProjectStatus);
router.patch("/:id/section", protect, setProjectSection);
router.delete("/:id", protect, deleteProject);

module.exports = router;
