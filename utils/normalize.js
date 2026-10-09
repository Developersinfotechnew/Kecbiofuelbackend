/**
 * Turns whatever JSON the admin pastes (or the old static blogData.jsx shape)
 * into the canonical shape the Blog / Project models expect.
 *
 * Old shape:   image: "/x.jpg", thumbnail: "/y.jpg", seo.title, ...
 * New shape:   heroBanner: {desktop, mobile, alt}, thumbnail: {...}, seo.metaTitle, ...
 * Both are accepted. Only keys that are PRESENT in the input are returned, so
 * partial updates never wipe other fields.
 */
const has = (obj, key) => obj && Object.prototype.hasOwnProperty.call(obj, key);

const str = (v) => (v === undefined || v === null ? "" : String(v).trim());

function toImageSet(v) {
  if (!v) return { desktop: "", mobile: "", alt: "" };
  if (typeof v === "string") return { desktop: v.trim(), mobile: "", alt: "" };
  return {
    desktop: str(v.desktop || v.url || v.src || v.image),
    mobile: str(v.mobile || v.mobileUrl || v.mobileImage),
    alt: str(v.alt || v.altText),
  };
}

function toArray(v) {
  if (v === undefined || v === null || v === "") return [];
  if (Array.isArray(v)) return v.map((x) => str(x)).filter(Boolean);
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.map((x) => str(x)).filter(Boolean);
    } catch (e) {
      /* not JSON, fall through */
    }
    return v.split(",").map((x) => x.trim()).filter(Boolean);
  }
  return [];
}

function toDate(v) {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function toBool(v) {
  return v === true || v === "true";
}

function toNumber(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeSeo(seo) {
  if (!seo || typeof seo !== "object") return {};
  const out = {};
  const copy = (to, ...from) => {
    for (const k of from) {
      if (has(seo, k)) {
        out[to] = str(seo[k]);
        return;
      }
    }
  };
  copy("metaTitle", "metaTitle", "title");
  copy("metaDescription", "metaDescription", "description");
  copy("focusKeyword", "focusKeyword");
  copy("canonicalUrl", "canonicalUrl", "canonical");
  copy("robots", "robots");
  copy("ogTitle", "ogTitle");
  copy("ogDescription", "ogDescription");
  copy("ogImage", "ogImage");
  copy("ogType", "ogType");
  copy("twitterCard", "twitterCard");
  copy("twitterTitle", "twitterTitle");
  copy("twitterDescription", "twitterDescription");
  copy("twitterImage", "twitterImage");
  if (has(seo, "structuredData")) {
    out.structuredData =
      typeof seo.structuredData === "string"
        ? seo.structuredData
        : JSON.stringify(seo.structuredData, null, 2);
  }
  if (has(seo, "primaryKeywords")) out.primaryKeywords = toArray(seo.primaryKeywords);
  if (has(seo, "secondaryKeywords")) out.secondaryKeywords = toArray(seo.secondaryKeywords);
  if (has(seo, "metaKeywords") && !has(seo, "primaryKeywords")) {
    out.primaryKeywords = toArray(seo.metaKeywords);
  }
  return out;
}

function normalizeSections(sections) {
  if (!Array.isArray(sections)) return [];
  return sections.map((s) => ({
    subheading: str(s.subheading || s.heading || s.title),
    content: typeof s.content === "string" ? s.content : str(s.content),
    image: toImageSet(s.image),
  }));
}

function normalizeBlogBody(body = {}) {
  const out = {};
  ["title", "slug", "excerpt", "category", "author", "authorBio", "readTime"].forEach((k) => {
    if (has(body, k)) out[k] = str(body[k]);
  });
  if (has(body, "content")) out.content = typeof body.content === "string" ? body.content : "";
  if (has(body, "date")) out.date = toDate(body.date);
  if (has(body, "tags")) out.tags = toArray(body.tags);
  if (has(body, "featured")) out.featured = toBool(body.featured);
  if (has(body, "status")) out.status = body.status === "published" ? "published" : "draft";
  if (has(body, "views")) out.views = toNumber(body.views, 0);
  if (has(body, "likes")) out.likes = toNumber(body.likes, 0);

  // heroBanner (new) <- image (old)
  if (has(body, "heroBanner")) out.heroBanner = toImageSet(body.heroBanner);
  else if (has(body, "image")) out.heroBanner = toImageSet(body.image);
  if (has(body, "thumbnail")) out.thumbnail = toImageSet(body.thumbnail);
  if (has(body, "introImage")) out.introImage = toImageSet(body.introImage);

  if (has(body, "sections")) out.sections = normalizeSections(body.sections);
  if (has(body, "seo")) out.seo = normalizeSeo(body.seo);
  return out;
}

function normalizeProjectBody(body = {}) {
  const out = {};
  [
    "title", "slug", "section", "client", "location", "state", "capacity",
    "scope", "technology", "stage", "summary", "stageLabel",
  ].forEach((k) => {
    if (has(body, k)) out[k] = str(body[k]);
  });
  if (has(body, "section")) out.section = body.section === "onboarded" ? "onboarded" : "active";
  if (has(body, "description")) out.description = typeof body.description === "string" ? body.description : "";
  if (has(body, "progress")) out.progress = Math.min(100, Math.max(0, toNumber(body.progress, 0)));
  if (has(body, "order")) out.order = toNumber(body.order, 0);
  if (has(body, "featured")) out.featured = toBool(body.featured);
  if (has(body, "status")) out.status = body.status === "published" ? "published" : "draft";
  ["startDate", "expectedCompletion", "onboardedDate"].forEach((k) => {
    if (has(body, k)) out[k] = toDate(body[k]) || null;
  });
  if (has(body, "highlights")) out.highlights = toArray(body.highlights);
  if (has(body, "details") && Array.isArray(body.details)) {
    out.details = body.details
      .map((d) => ({ label: str(d.label), value: str(d.value) }))
      .filter((d) => d.label || d.value);
  }
  if (has(body, "hero") && body.hero && typeof body.hero === "object") {
    out.hero = {
      badge: str(body.hero.badge),
      title: str(body.hero.title),
      subtitle: str(body.hero.subtitle),
      tags: toArray(body.hero.tags),
    };
  }
  if (has(body, "heroBanner")) out.heroBanner = toImageSet(body.heroBanner);
  else if (has(body, "image")) out.heroBanner = toImageSet(body.image);
  if (has(body, "thumbnail")) out.thumbnail = toImageSet(body.thumbnail);
  if (has(body, "gallery") && Array.isArray(body.gallery)) out.gallery = body.gallery.map(toImageSet);
  if (has(body, "sections")) out.sections = normalizeSections(body.sections);
  if (has(body, "updates") && Array.isArray(body.updates)) {
    out.updates = body.updates.map((u) => ({
      date: toDate(u.date) || new Date(),
      title: str(u.title),
      description: typeof u.description === "string" ? u.description : str(u.description),
      image: toImageSet(u.image),
    }));
  }
  if (has(body, "seo")) out.seo = normalizeSeo(body.seo);
  return out;
}

module.exports = { normalizeBlogBody, normalizeProjectBody, normalizeSeo, toImageSet };