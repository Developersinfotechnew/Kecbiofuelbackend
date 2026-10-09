const mongoose = require("mongoose");
const slugify = require("slugify");

const webinarSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, "Title is required"], trim: true, maxlength: 150 },
    slug: { type: String, unique: true, lowercase: true, trim: true, index: true },
    description: { type: String, trim: true, default: "" },
    host: { type: String, trim: true, default: "" },
    bannerUrl: { type: String, trim: true, default: "" },

    // Stored in UTC. Frontend shows it in the viewer's / IST timezone.
    startsAt: { type: Date, required: [true, "Start date & time is required"], index: true },
    durationMins: { type: Number, default: 60, min: 5 },

    // Zoom / Google Meet / Teams link. NEVER sent to the public API; only
    // revealed to a booking after payment is verified.
    meetingLink: { type: String, trim: true, default: "" },
    meetingPlatform: { type: String, trim: true, default: "Zoom" },

    price: { type: Number, default: 0, min: 0 }, // INR rupees. 0 = free
    capacity: { type: Number, default: 0, min: 0 }, // 0 = unlimited

    status: { type: String, enum: ["draft", "published", "cancelled"], default: "draft", index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true }
);

webinarSchema.pre("validate", async function (next) {
  try {
    if (this.isModified("slug") && this.slug) {
      this.slug = slugify(this.slug, { lower: true, strict: true, trim: true });
    }
    if (!this.slug) {
      const base = slugify(this.title || "webinar", { lower: true, strict: true, trim: true }) || "webinar";
      let slug = base;
      let n = 2;
      // eslint-disable-next-line no-await-in-loop
      while (await this.constructor.findOne({ slug, _id: { $ne: this._id } }).select("_id").lean()) {
        slug = `${base}-${n++}`;
      }
      this.slug = slug;
    }
    next();
  } catch (e) {
    next(e);
  }
});

module.exports = mongoose.model("Webinar", webinarSchema);
