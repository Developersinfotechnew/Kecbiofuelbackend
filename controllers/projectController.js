const asyncHandler = require("express-async-handler");
const Project = require("../models/Project");
const ApiFeatures = require("../utils/apiFeatures");
const { normalizeProjectBody } = require("../utils/normalize");

// Table needs summary fields only; full content loads on the detail page.
const LIST_EXCLUDE = "-description -sections -updates -gallery -seo.structuredData";

// @desc    Published projects for the Project Management page tables
// @route   GET /api/projects
// @query   section=active|onboarded, search, page, limit
// @access  Public
const getPublicProjects = asyncHandler(async (req, res) => {
  const baseQuery = { status: "published" };

  const features = new ApiFeatures(Project.find(baseQuery).select(LIST_EXCLUDE), req.query)
    .search(["title", "client", "location", "state", "scope"])
    .filter(["section", "featured"])
    .sort("order -createdAt")
    .paginate();

  const [projects, total] = await Promise.all([features.query, Project.countDocuments(baseQuery)]);

  res.json({
    success: true,
    count: projects.length,
    total,
    page: features.pagination.page,
    pages: Math.ceil(total / features.pagination.limit),
    data: projects,
  });
});

// @desc    One published project (full) for its own page
// @route   GET /api/projects/slug/:slug
// @access  Public
const getProjectBySlug = asyncHandler(async (req, res) => {
  const project = await Project.findOne({ slug: req.params.slug, status: "published" });
  if (!project) {
    res.status(404);
    throw new Error("Project not found");
  }
  res.json({ success: true, data: project });
});

// @desc    All projects, any status (admin table)
// @route   GET /api/projects/admin/all
// @access  Private
const getAllProjectsAdmin = asyncHandler(async (req, res) => {
  const features = new ApiFeatures(Project.find().select(LIST_EXCLUDE), req.query)
    .search(["title", "client", "location", "slug"])
    .filter(["section", "status", "featured"])
    .sort("section order -createdAt")
    .paginate();

  const [projects, total] = await Promise.all([features.query, Project.countDocuments()]);

  res.json({
    success: true,
    count: projects.length,
    total,
    page: features.pagination.page,
    pages: Math.ceil(total / features.pagination.limit),
    data: projects,
  });
});

// @desc    One project by id for admin edit form
// @route   GET /api/projects/admin/:id
// @access  Private
const getProjectByIdAdmin = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) {
    res.status(404);
    throw new Error("Project not found");
  }
  res.json({ success: true, data: project });
});

// @desc    Create project (JSON body)
// @route   POST /api/projects
// @access  Private
const createProject = asyncHandler(async (req, res) => {
  const data = normalizeProjectBody(req.body);
  if (!data.title) {
    res.status(400);
    throw new Error("title (project name) is required");
  }
  const project = await Project.create({ ...data, createdBy: req.admin._id });
  res.status(201).json({ success: true, data: project });
});

// @desc    Update project. Only keys present in the body change.
// @route   PUT /api/projects/:id
// @access  Private
const updateProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) {
    res.status(404);
    throw new Error("Project not found");
  }

  const data = normalizeProjectBody(req.body);
  const { seo, ...rest } = data;

  Object.entries(rest).forEach(([key, value]) => {
    project[key] = value;
  });
  if (seo) project.seo = { ...(project.seo ? project.seo.toObject() : {}), ...seo };

  const updated = await project.save();
  res.json({ success: true, data: updated });
});

// @desc    Publish / unpublish quickly
// @route   PATCH /api/projects/:id/status
// @access  Private
const setProjectStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["draft", "published"].includes(status)) {
    res.status(400);
    throw new Error("status must be 'draft' or 'published'");
  }
  const project = await Project.findById(req.params.id);
  if (!project) {
    res.status(404);
    throw new Error("Project not found");
  }
  project.status = status;
  await project.save();
  res.json({ success: true, data: { _id: project._id, status: project.status } });
});

// @desc    Move project between Active <-> Onboarded
// @route   PATCH /api/projects/:id/section
// @access  Private
const setProjectSection = asyncHandler(async (req, res) => {
  const { section } = req.body;
  if (!["active", "onboarded"].includes(section)) {
    res.status(400);
    throw new Error("section must be 'active' or 'onboarded'");
  }
  const project = await Project.findById(req.params.id);
  if (!project) {
    res.status(404);
    throw new Error("Project not found");
  }
  project.section = section;
  await project.save();
  res.json({ success: true, data: { _id: project._id, section: project.section } });
});

// @desc    Delete project
// @route   DELETE /api/projects/:id
// @access  Private
const deleteProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) {
    res.status(404);
    throw new Error("Project not found");
  }
  await project.deleteOne();
  res.json({ success: true, data: { _id: req.params.id } });
});

module.exports = {
  getPublicProjects,
  getProjectBySlug,
  getAllProjectsAdmin,
  getProjectByIdAdmin,
  createProject,
  updateProject,
  setProjectStatus,
  setProjectSection,
  deleteProject,
};
