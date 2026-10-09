const fs = require("fs");
const path = require("path");
const asyncHandler = require("express-async-handler");
const Video = require("../models/Video");
const ApiFeatures = require("../utils/apiFeatures");

const THUMBNAIL_DIR = path.join(__dirname, "..", "uploads", "thumbnails");

// The frontend can send tags / metaKeywords either as a real JSON array
// (application/json requests) or as a comma-separated / JSON string inside
// multipart form-data (since HTML forms can't send nested arrays natively).
// This normalizes either shape into a clean string array.
function parseArrayField(value) {
  if (value === undefined || value === null || value === "") return undefined;
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean);
  } catch (e) {
    // not JSON - fall through to comma split
  }
  return String(value)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

// The "seo" object is sent either as real JSON (application/json) or as a
// JSON-encoded string inside a multipart field named "seo".
function parseSeoField(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch (e) {
    return {};
  }
}

function buildThumbnailUrl(filename) {
  return `/uploads/thumbnails/${filename}`;
}

// Removes a thumbnail file from disk given its stored /uploads/... URL.
// Silently ignores missing files so deletes/updates never fail because of it.
function deleteThumbnailFile(thumbnailUrl) {
  if (!thumbnailUrl) return;
  const filename = path.basename(thumbnailUrl);
  const filePath = path.join(THUMBNAIL_DIR, filename);
  fs.unlink(filePath, (err) => {
    if (err && err.code !== "ENOENT") {
      console.error(`Failed to delete thumbnail file ${filePath}:`, err.message);
    }
  });
}

// @desc    List published videos (public site consumption)
// @route   GET /api/videos
// @query   search, category, tag, sort, page, limit
// @access  Public
const getPublicVideos = asyncHandler(async (req, res) => {
  const baseQuery = { status: "published" };
  if (req.query.tag) baseQuery.tags = req.query.tag;

  const features = new ApiFeatures(Video.find(baseQuery), req.query)
    .search(["title", "description", "shortDescription", "tags"])
    .filter(["category", "isFeatured", "videoType"])
    .sort("-order -publishedAt")
    .paginate();

  const [videos, total] = await Promise.all([
    features.query,
    Video.countDocuments(baseQuery),
  ]);

  res.json({
    success: true,
    count: videos.length,
    total,
    page: features.pagination.page,
    pages: Math.ceil(total / features.pagination.limit),
    data: videos,
  });
});

// @desc    Get a single published video by slug, for the public video page
// @route   GET /api/videos/slug/:slug
// @access  Public
const getVideoBySlug = asyncHandler(async (req, res) => {
  const video = await Video.findOneAndUpdate(
    { slug: req.params.slug, status: "published" },
    { $inc: { views: 1 } },
    { new: true }
  );

  if (!video) {
    res.status(404);
    throw new Error("Video not found");
  }

  res.json({ success: true, data: video });
});

// @desc    List all videos regardless of status (admin panel table)
// @route   GET /api/videos/admin/all
// @query   search, category, status, sort, page, limit
// @access  Private
const getAllVideosAdmin = asyncHandler(async (req, res) => {
  const features = new ApiFeatures(Video.find(), req.query)
    .search(["title", "description", "shortDescription", "tags"])
    .filter(["category", "status", "isFeatured", "videoType"])
    .sort("-createdAt")
    .paginate();

  const [videos, total] = await Promise.all([
    features.query.populate("createdBy", "name email"),
    Video.countDocuments(),
  ]);

  res.json({
    success: true,
    count: videos.length,
    total,
    page: features.pagination.page,
    pages: Math.ceil(total / features.pagination.limit),
    data: videos,
  });
});

// @desc    Get one video by id, for the admin edit form (any status)
// @route   GET /api/videos/admin/:id
// @access  Private
const getVideoByIdAdmin = asyncHandler(async (req, res) => {
  const video = await Video.findById(req.params.id).populate("createdBy", "name email");

  if (!video) {
    res.status(404);
    throw new Error("Video not found");
  }

  res.json({ success: true, data: video });
});

// @desc    Create a new video entry (YouTube link + uploaded thumbnail + SEO)
// @route   POST /api/videos
// @access  Private
const createVideo = asyncHandler(async (req, res) => {
  const {
    title,
    slug,
    youtubeUrl,
    description,
    shortDescription,
    category,
    videoType,
    duration,
    status,
    isFeatured,
    order,
  } = req.body;

  if (!title || !youtubeUrl) {
    res.status(400);
    throw new Error("title and youtubeUrl are required");
  }

  if (!req.file) {
    res.status(400);
    throw new Error("Thumbnail image is required");
  }

  const seo = parseSeoField(req.body.seo);
  const tags = parseArrayField(req.body.tags);
  if (seo.metaKeywords) {
    seo.metaKeywords = parseArrayField(seo.metaKeywords);
  }

  const video = await Video.create({
    title,
    slug,
    youtubeUrl,
    description,
    shortDescription,
    category,
    videoType: videoType === "short" ? "short" : "video",
    duration,
    tags,
    status: status === "published" ? "published" : "draft",
    isFeatured: isFeatured === "true" || isFeatured === true,
    order: order !== undefined ? Number(order) : undefined,
    thumbnail: {
      url: buildThumbnailUrl(req.file.filename),
      altText: req.body.thumbnailAlt || title,
    },
    seo,
    createdBy: req.admin._id,
  });

  res.status(201).json({ success: true, data: video });
});

// @desc    Update an existing video. Replacing the thumbnail is optional.
// @route   PUT /api/videos/:id
// @access  Private
const updateVideo = asyncHandler(async (req, res) => {
  const video = await Video.findById(req.params.id);

  if (!video) {
    res.status(404);
    throw new Error("Video not found");
  }

  const fields = [
    "title",
    "slug",
    "youtubeUrl",
    "description",
    "shortDescription",
    "category",
    "videoType",
    "duration",
    "status",
  ];
  fields.forEach((field) => {
    if (req.body[field] !== undefined) video[field] = req.body[field];
  });

  if (req.body.isFeatured !== undefined) {
    video.isFeatured = req.body.isFeatured === "true" || req.body.isFeatured === true;
  }
  if (req.body.order !== undefined) {
    video.order = Number(req.body.order);
  }
  if (req.body.tags !== undefined) {
    video.tags = parseArrayField(req.body.tags) || [];
  }

  // Merge incoming SEO fields onto the existing subdocument rather than
  // replacing it wholesale, so partial SEO edits don't wipe other fields.
  if (req.body.seo !== undefined) {
    const incomingSeo = parseSeoField(req.body.seo);
    if (incomingSeo.metaKeywords) {
      incomingSeo.metaKeywords = parseArrayField(incomingSeo.metaKeywords);
    }
    video.seo = { ...(video.seo ? video.seo.toObject() : {}), ...incomingSeo };
  }

  // Swap the thumbnail only if a new file was uploaded; delete the old one.
  if (req.file) {
    const oldThumbnailUrl = video.thumbnail?.url;
    video.thumbnail = {
      url: buildThumbnailUrl(req.file.filename),
      altText: req.body.thumbnailAlt || video.thumbnail?.altText || video.title,
    };
    if (oldThumbnailUrl) deleteThumbnailFile(oldThumbnailUrl);
  } else if (req.body.thumbnailAlt !== undefined) {
    video.thumbnail.altText = req.body.thumbnailAlt;
  }

  const updated = await video.save();

  res.json({ success: true, data: updated });
});

// @desc    Quickly change only a video's status (publish/unpublish/draft)
// @route   PATCH /api/videos/:id/status
// @access  Private
const setVideoStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!["draft", "published"].includes(status)) {
    res.status(400);
    throw new Error("status must be 'draft' or 'published'");
  }

  const video = await Video.findById(req.params.id);
  if (!video) {
    res.status(404);
    throw new Error("Video not found");
  }

  video.status = status;
  const updated = await video.save();

  res.json({ success: true, data: updated });
});

// @desc    Delete a video and its thumbnail file
// @route   DELETE /api/videos/:id
// @access  Private
const deleteVideo = asyncHandler(async (req, res) => {
  const video = await Video.findById(req.params.id);

  if (!video) {
    res.status(404);
    throw new Error("Video not found");
  }

  deleteThumbnailFile(video.thumbnail?.url);
  await video.deleteOne();

  res.json({ success: true, data: { _id: req.params.id } });
});

module.exports = {
  getPublicVideos,
  getVideoBySlug,
  getAllVideosAdmin,
  getVideoByIdAdmin,
  createVideo,
  updateVideo,
  setVideoStatus,
  deleteVideo,
};