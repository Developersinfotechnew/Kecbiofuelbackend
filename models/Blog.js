const mongoose = require("mongoose");
const { imageSetSchema, sectionSchema, seoSchema } = require("./_shared");
const { attachSlugHook } = require("../utils/slug");

const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, "Title is required"], trim: true, maxlength: 250 },
    slug: { type: String, unique: true, lowercase: true, trim: true, index: true },
    excerpt: { type: String, trim: true, default: "" },
    content: { type: String, default: "" }, // intro / main content (\n\n = new paragraph)
    category: { type: String, trim: true, default: "General" },
    author: { type: String, trim: true, default: "KEC Biofuel Team" },
    authorBio: { type: String, trim: true, default: "" },
    date: { type: Date, default: Date.now },
    readTime: { type: String, trim: true, default: "" },
    tags: [{ type: String, trim: true }],

    // Images - each has a desktop and a mobile version
    heroBanner: { type: imageSetSchema, default: () => ({}) }, // top of the blog detail page
    thumbnail: { type: imageSetSchema, default: () => ({}) }, // cards on listing / related posts
    introImage: { type: imageSetSchema, default: () => ({}) }, // right after the intro content

    sections: { type: [sectionSchema], default: [] },

    status: { type: String, enum: ["draft", "published"], default: "draft" },
    featured: { type: Boolean, default: false },
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    publishedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },

    seo: { type: seoSchema, default: () => ({}) },
  },
  { timestamps: true }
);

attachSlugHook(blogSchema, "blog");

blogSchema.pre("validate", function stampPublished(next) {
  if (this.isModified("status") && this.status === "published" && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  next();
});

blogSchema.index({ status: 1, date: -1 });

module.exports = mongoose.model("Blog", blogSchema);
