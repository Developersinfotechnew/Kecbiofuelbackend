/**
 * One-time import of existing content into MongoDB so it becomes editable
 * from the admin panel.
 *
 *   node scripts/seedFromJson.js blogs                 # seed/blogs.json
 *   node scripts/seedFromJson.js projects              # seed/projects.sample.json
 *   node scripts/seedFromJson.js blogs --force         # overwrite same-slug docs
 *
 * Needs MONGO_URI (or MONGODB_URI) in .env. Existing slugs are skipped
 * unless --force is given.
 */
require("dotenv").config();
const path = require("path");
const mongoose = require("mongoose");
const Blog = require("../models/Blog");
const Project = require("../models/Project");
const { normalizeBlogBody, normalizeProjectBody } = require("../utils/normalize");

const TARGETS = {
  blogs: { Model: Blog, file: "../seed/blogs.json", normalize: normalizeBlogBody },
  projects: { Model: Project, file: "../seed/projects.sample.json", normalize: normalizeProjectBody },
};

(async () => {
  const [, , kind, flag] = process.argv;
  const target = TARGETS[kind];
  if (!target) {
    console.error("Usage: node scripts/seedFromJson.js <blogs|projects> [--force]");
    process.exit(1);
  }

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error("Set MONGO_URI (or MONGODB_URI) in .env");
    process.exit(1);
  }

  await mongoose.connect(uri);
  const items = require(path.join(__dirname, target.file));
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const raw of items) {
    const data = target.normalize(raw);
    const existing = data.slug ? await target.Model.findOne({ slug: data.slug }) : null;

    if (existing && flag !== "--force") {
      skipped += 1;
      continue;
    }
    if (existing) {
      Object.assign(existing, data);
      await existing.save();
      updated += 1;
    } else {
      await target.Model.create(data);
      created += 1;
    }
  }

  console.log(`${kind}: ${created} created, ${updated} updated, ${skipped} skipped`);
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
