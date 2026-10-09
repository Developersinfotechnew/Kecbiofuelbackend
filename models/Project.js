const mongoose = require("mongoose");
const { imageSetSchema, sectionSchema, seoSchema } = require("./_shared");
const { attachSlugHook } = require("../utils/slug");

const updateSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  title: { type: String, trim: true, default: "" },
  description: { type: String, default: "" },
  image: { type: imageSetSchema, default: () => ({}) },
});

const detailSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, default: "" },
    value: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

// Text shown in the project page hero. Any blank field falls back to a default
// (badge -> "Active/Onboarded Project", title -> project name, subtitle -> summary, tags -> scope).
const heroSchema = new mongoose.Schema(
  {
    badge: { type: String, trim: true, default: "" },
    title: { type: String, trim: true, default: "" },
    subtitle: { type: String, trim: true, default: "" },
    tags: [{ type: String, trim: true }],
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, "Project name is required"], trim: true, maxlength: 250 },
    slug: { type: String, unique: true, lowercase: true, trim: true, index: true },

    // Which table on the Project Management page the project shows in.
    section: { type: String, enum: ["active", "onboarded"], default: "active", index: true },

    // ---- Table columns ----
    client: { type: String, trim: true, default: "" },
    location: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    capacity: { type: String, trim: true, default: "" }, // e.g. "8 TPD"
    scope: { type: String, trim: true, default: "" }, // e.g. "PMC", "EPC", "PMC + EPC"
    technology: { type: String, trim: true, default: "" },
    stage: { type: String, trim: true, default: "" }, // e.g. "Civil Work"
    progress: { type: Number, min: 0, max: 100, default: 0 },
    startDate: { type: Date },
    expectedCompletion: { type: Date },
    onboardedDate: { type: Date },

    // ---- Detail page ----
    summary: { type: String, trim: true, default: "" },
    description: { type: String, default: "" },
    highlights: [{ type: String, trim: true }],
    details: { type: [detailSchema], default: [] }, // extra label/value rows
    sections: { type: [sectionSchema], default: [] },
    updates: { type: [updateSchema], default: [] }, // "Project Updates" timeline
    gallery: { type: [imageSetSchema], default: [] },

    hero: { type: heroSchema, default: () => ({}) },
    heroBanner: { type: imageSetSchema, default: () => ({}) }, // hero image (desktop + mobile)
    thumbnail: { type: imageSetSchema, default: () => ({}) },

    status: { type: String, enum: ["draft", "published"], default: "draft" },
    featured: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    publishedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },

    seo: { type: seoSchema, default: () => ({ ogType: "website" }) },
  },
  { timestamps: true }
);

attachSlugHook(projectSchema, "project");

projectSchema.pre("validate", function stampPublished(next) {
  if (this.isModified("status") && this.status === "published" && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  next();
});

module.exports = mongoose.model("Project", projectSchema);