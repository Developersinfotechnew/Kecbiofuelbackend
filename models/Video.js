const mongoose = require("mongoose");
const slugify = require("slugify");
const { extractYoutubeId, buildEmbedUrl } = require("../utils/youtube");

// Everything an admin might want to control for on-page and social SEO.
const seoSchema = new mongoose.Schema(
  {
    metaTitle: { type: String, trim: true, maxlength: 70 },
    metaDescription: { type: String, trim: true, maxlength: 160 },
    metaKeywords: [{ type: String, trim: true }],
    focusKeyword: { type: String, trim: true },
    canonicalUrl: { type: String, trim: true },
    robots: { type: String, trim: true, default: "index, follow" },

    // Open Graph (Facebook/LinkedIn/WhatsApp previews)
    ogTitle: { type: String, trim: true },
    ogDescription: { type: String, trim: true },
    ogImage: { type: String, trim: true },
    ogType: { type: String, trim: true, default: "video.other" },

    // Twitter / X card
    twitterCard: { type: String, trim: true, default: "summary_large_image" },
    twitterTitle: { type: String, trim: true },
    twitterDescription: { type: String, trim: true },
    twitterImage: { type: String, trim: true },

    // Optional raw JSON-LD the admin can paste for advanced structured data.
    // Stored as-is; the frontend is responsible for rendering it in a
    // <script type="application/ld+json"> tag.
    structuredData: { type: String },
  },
  { _id: false }
);

const videoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: 150,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    youtubeUrl: {
      type: String,
      required: [true, "YouTube video link is required"],
      trim: true,
    },
    youtubeVideoId: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    shortDescription: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    thumbnail: {
      url: { type: String, required: [true, "Thumbnail image is required"] },
      altText: { type: String, trim: true, default: "" },
    },
    category: {
      type: String,
      trim: true,
      default: "General",
    },
    videoType: {
      type: String,
      enum: ["video", "short"],
      default: "video",
    },
    tags: [{ type: String, trim: true }],
    duration: {
      type: String, // e.g. "12:45" - stored as free text, admin enters it
      trim: true,
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0,
    },
    views: {
      type: Number,
      default: 0,
    },
    publishedAt: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    seo: {
      type: seoSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

videoSchema.virtual("embedUrl").get(function () {
  return buildEmbedUrl(this.youtubeVideoId);
});

videoSchema.set("toJSON", { virtuals: true });
videoSchema.set("toObject", { virtuals: true });

/**
 * Before validation runs:
 *  1. Extract/validate the YouTube video ID whenever the link changes.
 *  2. Auto-generate a URL-safe slug from the title if none was supplied,
 *     or clean up a manually-supplied slug.
 *  3. Guarantee slug uniqueness by appending -2, -3, ... on collision.
 *  4. Stamp publishedAt the first time a video is set to "published".
 */
videoSchema.pre("validate", async function preValidate(next) {
  try {
    if (this.isModified("youtubeUrl")) {
      const videoId = extractYoutubeId(this.youtubeUrl);
      if (!videoId) {
        return next(new Error("youtubeUrl is not a valid YouTube video link"));
      }
      this.youtubeVideoId = videoId;
    }

    if (this.isModified("slug") && this.slug) {
      // Admin explicitly set/changed the slug - normalize and de-duplicate it.
      const base = slugify(this.slug, { lower: true, strict: true, trim: true });
      this.slug = await ensureUniqueSlug(this.constructor, base, this._id);
    } else if (!this.slug) {
      // No slug yet (new video, or it was cleared) - derive one from the title.
      // Once a slug exists, later title edits do NOT change it, so published
      // links and SEO stay stable unless the admin edits the slug on purpose.
      const base = slugify(this.title || "", { lower: true, strict: true, trim: true });
      this.slug = await ensureUniqueSlug(this.constructor, base, this._id);
    }

    if (this.isModified("status") && this.status === "published" && !this.publishedAt) {
      this.publishedAt = new Date();
    }

    next();
  } catch (err) {
    next(err);
  }
});

/**
 * Appends -2, -3, etc. to a slug base until it no longer collides with
 * another document (excluding the current one, for updates).
 */
async function ensureUniqueSlug(Model, base, currentId) {
  let slug = base || "video";
  let counter = 2;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const query = { slug };
    if (currentId) query._id = { $ne: currentId };
    const existing = await Model.findOne(query).select("_id").lean();
    if (!existing) return slug;
    slug = `${base}-${counter}`;
    counter += 1;
  }
}

module.exports = mongoose.model("Video", videoSchema);