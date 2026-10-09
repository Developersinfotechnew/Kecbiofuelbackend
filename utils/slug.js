const slugify = require("slugify");

/**
 * Appends -2, -3, ... to a slug base until it no longer collides with
 * another document (the current document is excluded, so updates work).
 */
async function ensureUniqueSlug(Model, base, currentId, fallback = "item") {
  const root = base || fallback;
  let slug = root;
  let counter = 2;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const query = { slug };
    if (currentId) query._id = { $ne: currentId };
    const existing = await Model.findOne(query).select("_id").lean();
    if (!existing) return slug;
    slug = `${root}-${counter}`;
    counter += 1;
  }
}

/**
 * Adds the same slug behaviour the Video model uses:
 *  - slug supplied/changed by admin -> cleaned + made unique
 *  - slug empty                     -> generated from `title`
 *  - once set, later title edits do NOT change the slug (stable SEO URLs)
 */
function attachSlugHook(schema, fallback) {
  schema.pre("validate", async function slugHook(next) {
    try {
      if (this.isModified("slug") && this.slug) {
        const base = slugify(this.slug, { lower: true, strict: true, trim: true });
        this.slug = await ensureUniqueSlug(this.constructor, base, this._id, fallback);
      } else if (!this.slug) {
        const base = slugify(this.title || "", { lower: true, strict: true, trim: true });
        this.slug = await ensureUniqueSlug(this.constructor, base, this._id, fallback);
      }
      next();
    } catch (err) {
      next(err);
    }
  });
}

module.exports = { ensureUniqueSlug, attachSlugHook };
