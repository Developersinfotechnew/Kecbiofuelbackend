const asyncHandler = require("express-async-handler");
const Blog = require("../models/Blog");
const ApiFeatures = require("../utils/apiFeatures");
const { normalizeBlogBody } = require("../utils/normalize");

// Fields the listing pages don't need - keeps list responses small.
const LIST_EXCLUDE = "-content -sections -seo.structuredData";

// @desc    Published blogs for the public site (cards / listing)
// @route   GET /api/blogs
// @query   search, category, featured, page, limit
// @access  Public
const getPublicBlogs = asyncHandler(async (req, res) => {
  const baseQuery = { status: "published" };
  if (req.query.tag) baseQuery.tags = req.query.tag;

  const features = new ApiFeatures(Blog.find(baseQuery).select(LIST_EXCLUDE), req.query)
    .search(["title", "excerpt", "category", "tags"])
    .filter(["category", "featured"])
    .sort("-date")
    .paginate();

  const [blogs, total] = await Promise.all([features.query, Blog.countDocuments(baseQuery)]);

  res.json({
    success: true,
    count: blogs.length,
    total,
    page: features.pagination.page,
    pages: Math.ceil(total / features.pagination.limit),
    data: blogs,
  });
});

// @desc    One published blog (full content + SEO) for the detail page
// @route   GET /api/blogs/slug/:slug
// @access  Public
const getBlogBySlug = asyncHandler(async (req, res) => {
  const blog = await Blog.findOne({ slug: req.params.slug, status: "published" });
  if (!blog) {
    res.status(404);
    throw new Error("Blog not found");
  }
  res.json({ success: true, data: blog });
});

// @desc    Count one page view (called once from the browser, not from SSR)
// @route   POST /api/blogs/slug/:slug/view
// @access  Public
const addView = asyncHandler(async (req, res) => {
  const blog = await Blog.findOneAndUpdate(
    { slug: req.params.slug, status: "published" },
    { $inc: { views: 1 } },
    { new: true }
  ).select("views");
  res.json({ success: true, views: blog ? blog.views : 0 });
});

// @desc    All blogs, any status (admin table)
// @route   GET /api/blogs/admin/all
// @access  Private
const getAllBlogsAdmin = asyncHandler(async (req, res) => {
  const features = new ApiFeatures(Blog.find().select(LIST_EXCLUDE), req.query)
    .search(["title", "excerpt", "category", "slug"])
    .filter(["category", "status", "featured"])
    .sort("-createdAt")
    .paginate();

  const [blogs, total] = await Promise.all([features.query, Blog.countDocuments()]);

  res.json({
    success: true,
    count: blogs.length,
    total,
    page: features.pagination.page,
    pages: Math.ceil(total / features.pagination.limit),
    data: blogs,
  });
});

// @desc    One blog by id for the admin edit form
// @route   GET /api/blogs/admin/:id
// @access  Private
const getBlogByIdAdmin = asyncHandler(async (req, res) => {
  const blog = await Blog.findById(req.params.id);
  if (!blog) {
    res.status(404);
    throw new Error("Blog not found");
  }
  res.json({ success: true, data: blog });
});

// @desc    Create blog (JSON body - same shape as the admin "Import JSON" box)
// @route   POST /api/blogs
// @access  Private
const createBlog = asyncHandler(async (req, res) => {
  const data = normalizeBlogBody(req.body);
  if (!data.title) {
    res.status(400);
    throw new Error("title is required");
  }
  const blog = await Blog.create({ ...data, createdBy: req.admin._id });
  res.status(201).json({ success: true, data: blog });
});

// @desc    Update blog. Only keys present in the body are changed.
// @route   PUT /api/blogs/:id
// @access  Private
const updateBlog = asyncHandler(async (req, res) => {
  const blog = await Blog.findById(req.params.id);
  if (!blog) {
    res.status(404);
    throw new Error("Blog not found");
  }

  const data = normalizeBlogBody(req.body);
  const { seo, ...rest } = data;

  Object.entries(rest).forEach(([key, value]) => {
    blog[key] = value;
  });
  if (seo) blog.seo = { ...(blog.seo ? blog.seo.toObject() : {}), ...seo };

  const updated = await blog.save();
  res.json({ success: true, data: updated });
});

// @desc    Publish / unpublish quickly
// @route   PATCH /api/blogs/:id/status
// @access  Private
const setBlogStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["draft", "published"].includes(status)) {
    res.status(400);
    throw new Error("status must be 'draft' or 'published'");
  }
  const blog = await Blog.findById(req.params.id);
  if (!blog) {
    res.status(404);
    throw new Error("Blog not found");
  }
  blog.status = status;
  await blog.save();
  res.json({ success: true, data: { _id: blog._id, status: blog.status } });
});

// @desc    Delete blog
// @route   DELETE /api/blogs/:id
// @access  Private
const deleteBlog = asyncHandler(async (req, res) => {
  const blog = await Blog.findById(req.params.id);
  if (!blog) {
    res.status(404);
    throw new Error("Blog not found");
  }
  await blog.deleteOne();
  res.json({ success: true, data: { _id: req.params.id } });
});

module.exports = {
  getPublicBlogs,
  getBlogBySlug,
  addView,
  getAllBlogsAdmin,
  getBlogByIdAdmin,
  createBlog,
  updateBlog,
  setBlogStatus,
  deleteBlog,
};
