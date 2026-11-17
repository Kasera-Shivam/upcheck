import multer from "multer";
import createHttpError from "http-errors";

const MAX_AVATAR_SIZE_BYTES = 3 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export const uploadAvatarMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AVATAR_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype))
      return cb(
        new createHttpError.BadRequest(
          "Only JPG, PNG, and WebP images are allowed.",
        ),
      );
    cb(null, true);
  },
}).single("avatar");
