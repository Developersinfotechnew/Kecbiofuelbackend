const mongoose = require("mongoose");

// One image, two screen sizes. `mobile` falls back to `desktop` on the frontend.
const imageSetSchema = new mongoose.Schema(
  {
    desktop: { type: String, trim: true, default: "" },
    mobile: { type: String, trim: true, default: "" },
    alt: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const sectionSchema = new mongoose.Schema({
  subheading: { type: String, trim: true, default: "" },
  content: { type: String, default: "" },
  image: { type: imageSetSchema, default: () => ({}) },
});

const seoSchema = new mongoose.Schema(
  {
    metaTitle: { type: String, trim: true, maxlength: 120 },
    metaDescription: { type: String, trim: true, maxlength: 320 },
    primaryKeywords: [{ type: String, trim: true }],
    secondaryKeywords: [{ type: String, trim: true }],
    focusKeyword: { type: String, trim: true },
    canonicalUrl: { type: String, trim: true },
    robots: { type: String, trim: true, default: "index, follow" },

    ogTitle: { type: String, trim: true },
    ogDescription: { type: String, trim: true },
    ogImage: { type: String, trim: true },
    ogType: { type: String, trim: true, default: "article" },

    twitterCard: { type: String, trim: true, default: "summary_large_image" },
    twitterTitle: { type: String, trim: true },
    twitterDescription: { type: String, trim: true },
    twitterImage: { type: String, trim: true },

    // Raw JSON-LD text; rendered in <script type="application/ld+json"> by the frontend.
    structuredData: { type: String },
  },
  { _id: false }
);

module.exports = { imageSetSchema, sectionSchema, seoSchema };
