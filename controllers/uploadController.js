const asyncHandler = require("express-async-handler");
const cloudinary = require("../config/cloudinary");

const uploadBuffer = (buffer) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "kecbiofuel/media",
        resource_type: "image",
        // f_auto/q_auto are applied on delivery (see url below), original is kept.
      },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    stream.end(buffer);
  });

// @desc    Upload one image (used by blog + project image fields)
// @route   POST /api/uploads      (multipart, field name: "image")
// @access  Private
const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("No image file received");
  }

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    res.status(500);
    throw new Error("Cloudinary env vars are missing on the server");
  }

  const result = await uploadBuffer(req.file.buffer);

  // Full https URL. Frontend resolveMedia() leaves https:// URLs untouched.
  // Insert f_auto,q_auto so Cloudinary serves WebP/AVIF at smart quality.
  const url = result.secure_url.replace("/upload/", "/upload/f_auto,q_auto/");

  res.status(201).json({
    success: true,
    url,
    publicId: result.public_id,
    size: result.bytes,
  });
});

module.exports = { uploadImage };
