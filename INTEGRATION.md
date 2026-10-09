# Backend wiring (Blog + Project management)

## 1. Install (only if missing)
    npm i multer slugify express-async-handler dotenv

## 2. Mount routes in your server.js / app.js (next to the video routes)
    app.use("/api/blogs",    require("./routes/blogRoutes"));
    app.use("/api/projects", require("./routes/projectRoutes"));
    app.use("/api/uploads",  require("./routes/uploadRoutes"));

Make sure uploads are served statically (thumbnails already need this):
    app.use("/uploads", express.static(path.join(__dirname, "uploads")));

## 3. Move existing blogs into the DB (one time)
    node scripts/seedFromJson.js blogs
    node scripts/seedFromJson.js projects      # optional sample project

## New files
    models/_shared.js  models/Blog.js  models/Project.js
    controllers/blogController.js  controllers/projectController.js  controllers/uploadController.js
    routes/blogRoutes.js  routes/projectRoutes.js  routes/uploadRoutes.js
    config/mediaUpload.js  utils/slug.js  utils/normalize.js
    seed/blogs.json  seed/projects.sample.json  scripts/seedFromJson.js
