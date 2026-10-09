/**
 * Small chainable helper that turns req.query into mongoose query
 * operations: text search, field filters, sorting and pagination.
 *
 * Usage:
 *   const features = new ApiFeatures(Video.find(baseFilter), req.query)
 *     .search(["title", "description", "tags"])
 *     .filter(["category", "status", "isFeatured"])
 *     .sort("-createdAt")
 *     .paginate();
 *   const results = await features.query;
 */
class ApiFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  // Case-insensitive partial match on the given fields using ?search=
  search(fields = []) {
    if (this.queryString.search && fields.length) {
      const regex = new RegExp(this.queryString.search, "i");
      this.query = this.query.find({ $or: fields.map((f) => ({ [f]: regex })) });
    }
    return this;
  }

  // Exact-match filters on whitelisted fields, e.g. ?category=CBG&status=published
  filter(allowedFields = []) {
    const filters = {};
    allowedFields.forEach((field) => {
      if (this.queryString[field] !== undefined && this.queryString[field] !== "") {
        filters[field] = this.queryString[field];
      }
    });
    if (Object.keys(filters).length) {
      this.query = this.query.find(filters);
    }
    return this;
  }

  // ?sort=-createdAt,title  (comma separated, "-" prefix = descending)
  sort(defaultSort = "-createdAt") {
    const sortBy = this.queryString.sort
      ? this.queryString.sort.split(",").join(" ")
      : defaultSort;
    this.query = this.query.sort(sortBy);
    return this;
  }

  // ?page=2&limit=10
  paginate() {
    const page = Math.max(parseInt(this.queryString.page, 10) || 1, 1);
    const limit = Math.min(parseInt(this.queryString.limit, 10) || 12, 100);
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);
    this.pagination = { page, limit };
    return this;
  }
}

module.exports = ApiFeatures;
