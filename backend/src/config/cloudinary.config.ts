import env from "./env.config";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

export const uploadAvatarToCloudinary = (
  fileBuffer: Buffer,
  userId: string,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "uptime-monitor/avatars",
        public_id: userId,
        overwrite: true,
        invalidate: true,
        resource_type: "image",
        transformation: [
          { width: 256, height: 256, crop: "fill", gravity: "face" },
          { quality: "auto", fetch_format: "auto" },
        ],
      },
      (error, result) => {
        if (error || !result?.secure_url)
          return reject(error ?? new Error("Cloudinary upload failed."));
        resolve(result.secure_url);
      },
    );
    stream.end(fileBuffer);
  });
};

export const deleteAvatarFromCloudinary = async (userId: string) => {
  await cloudinary.uploader.destroy(`uptime-monitor/avatars/${userId}`, {
    invalidate: true,
  });
};

export default cloudinary;
