# KEC Biofuel — Backend (Video Manager API)

Express + Mongoose API powering an admin panel to manage **YouTube video entries**
(link only, no video file upload) with an uploaded **thumbnail image**, an
auto-generated **slug**, and a full **SEO** field set — for the KEC Biofuel
frontend.

## Folder structure

```
backend/
├── server.js               # app entry point
├── config/
│   ├── db.js                # MongoDB connection
│   └── multer.js             # thumbnail upload config (disk storage, image-only, size limit)
├── models/
│   ├── Admin.js               # admin/user accounts (bcrypt-hashed passwords)
│   └── Video.js                # video schema: youtube link, thumbnail, slug, SEO subdoc
├── controllers/
│   ├── authController.js       # register / login / me
│   └── videoController.js       # public listing/detail + admin CRUD
├── routes/
│   ├── authRoutes.js
│   └── videoRoutes.js
├── middleware/
│   ├── authMiddleware.js         # JWT `protect` + role `authorize`
│   └── errorMiddleware.js         # 404 + centralized error handler
├── utils/
│   ├── generateToken.js            # JWT signing
│   ├── youtube.js                   # extract/validate YouTube video ID
│   └── apiFeatures.js                 # search/filter/sort/pagination helper
├── seed/
│   └── createAdmin.js                  # CLI script to create a default admin
└── uploads/thumbnails/                  # uploaded thumbnail images are stored here
```

## Setup

```bash
cd backend
npm install
cp .env.example .env
# edit .env: set MONGO_URI, JWT_SECRET, CLIENT_URL, ADMIN_SETUP_KEY, etc.
```

Create your first admin account (either works):

```bash
# Option A — CLI seed, uses DEFAULT_ADMIN_* from .env
npm run seed:admin

# Option B — HTTP, using the ADMIN_SETUP_KEY from .env
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@kecbiofuel.com","password":"ChangeMe123!","setupKey":"<ADMIN_SETUP_KEY from .env>"}'
```

Run the server:

```bash
npm run dev     # nodemon, auto-restart
npm start       # plain node
```

The API is served at `http://localhost:5000` (or your `PORT`), and uploaded
thumbnails are served statically at `http://localhost:5000/uploads/thumbnails/<file>`.

## Auth

All admin routes require `Authorization: Bearer <token>`, where the token
comes from `/api/auth/login`.

| Method | Route              | Access  | Description                          |
|--------|--------------------|---------|---------------------------------------|
| POST   | `/api/auth/register` | Public* | Create an admin (*requires `setupKey`) |
| POST   | `/api/auth/login`    | Public  | Returns `{ data, token }`             |
| GET    | `/api/auth/me`       | Private | Current admin's profile               |

## Videos

| Method | Route                     | Access  | Description                                   |
|--------|---------------------------|---------|-------------------------------------------------|
| GET    | `/api/videos`               | Public  | Published videos only. Query: `search`, `category`, `tag`, `sort`, `page`, `limit` |
| GET    | `/api/videos/slug/:slug`     | Public  | One published video by slug (also `+1` view)     |
| GET    | `/api/videos/admin/all`       | Private | All videos, any status. Same query params + `status` |
| GET    | `/api/videos/admin/:id`        | Private | One video by id (for the edit form)               |
| POST   | `/api/videos`                    | Private | Create a video (multipart/form-data, see below)     |
| PUT    | `/api/videos/:id`                 | Private | Update a video (thumbnail optional)                   |
| PATCH  | `/api/videos/:id/status`           | Private | Body: `{ "status": "draft" \| "published" }`             |
| DELETE | `/api/videos/:id`                    | Private | Deletes the video doc + its thumbnail file                |

### Video fields

```
title              string, required
slug               string, optional — auto-generated from title if omitted,
                    and auto-deduplicated (my-video, my-video-2, ...)
youtubeUrl         string, required — any youtube.com/youtu.be link;
                    the video ID is extracted and validated automatically
description        string, required — full body/content for the detail page
shortDescription    string — used for cards/previews
thumbnail          file upload (field name: "thumbnail"), required on create
thumbnailAlt        string — alt text for the thumbnail image
category           string
tags               string[] — comma-separated or JSON array
duration           string, e.g. "12:45"
status             "draft" | "published" (default "draft")
isFeatured         boolean
order              number — for manual sort ordering
seo                object (see below) — sent as a JSON string in multipart requests
```

### `seo` object

```json
{
  "metaTitle": "",
  "metaDescription": "",
  "metaKeywords": ["cbg", "biogas"],
  "focusKeyword": "",
  "canonicalUrl": "",
  "robots": "index, follow",
  "ogTitle": "",
  "ogDescription": "",
  "ogImage": "",
  "ogType": "video.other",
  "twitterCard": "summary_large_image",
  "twitterTitle": "",
  "twitterDescription": "",
  "twitterImage": "",
  "structuredData": ""
}
```

All fields are optional; send only what you want to set. On updates, `seo`
is merged onto the existing object rather than replacing it.

### Create a video — example (multipart/form-data)

```bash
curl -X POST http://localhost:5000/api/videos \
  -H "Authorization: Bearer <token>" \
  -F "title=Plant Visit Walkthrough" \
  -F "youtubeUrl=https://www.youtube.com/watch?v=dQw4w9WgXcQ" \
  -F "description=Full walkthrough of our CBG plant..." \
  -F "shortDescription=A quick look inside the plant" \
  -F "category=Plant Visit" \
  -F "tags=cbg,plant,biogas" \
  -F "status=published" \
  -F "thumbnailAlt=CBG plant walkthrough thumbnail" \
  -F 'seo={"metaTitle":"Plant Visit | KEC Biofuel","metaDescription":"See inside our CBG plant.","metaKeywords":["cbg plant","biogas tour"]}' \
  -F "thumbnail=@/path/to/thumbnail.jpg"
```

From a browser/admin panel, build a `FormData` object with the same field
names (append `seo` and `tags` as `JSON.stringify(...)`).

## Notes

- Passwords are hashed with bcrypt; never returned in API responses.
- JWTs are stateless — there's no server-side session/logout list. To force
  a re-login, rotate `JWT_SECRET` or deactivate the admin (`isActive: false`).
- Thumbnails are stored on local disk under `uploads/thumbnails/`. Swap
  `config/multer.js` for a cloud storage driver (S3, Cloudinary, etc.) if
  you deploy somewhere without persistent disk.
- CORS is restricted to `CLIENT_URL` (comma-separate multiple origins, or
  use `*` for local testing only — not recommended in production).
