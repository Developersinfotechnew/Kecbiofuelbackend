const asyncHandler = require("express-async-handler");

// @desc    Upload one image (used by blog + project image fields)
// @route   POST /api/uploads      (multipart, field name: "image")
// @access  Private
const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("No image file received");
  }
  res.status(201).json({
    success: true,
    url: `/uploads/media/${req.file.filename}`,
    size: req.file.size,
  });
});

module.exports = { uploadImage };
