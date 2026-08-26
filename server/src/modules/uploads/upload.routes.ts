import { randomUUID } from "node:crypto";

import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../config/db.js";
import { AppError } from "../../middleware/error.js";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { generateThumbnail, generateThumbnailBuffer } from "../../shared/utils/imageThumbnails.js";
import { isSupabaseConfigured, uploadBufferToSupabase } from "../../shared/utils/supabaseStorage.js";
import { ALLOWED_MIME_TO_EXT, deleteUploadedFile, imageUpload, UPLOADS_URL_PREFIX } from "../../shared/utils/uploads.js";

const deleteImageSchema = z.object({ url: z.string().trim().min(1) });

const router = Router();

router.post(
  "/image",
  (req, res, next) => {
    imageUpload.single("file")(req, res, (err) => {
      if (err) {
        next(new AppError(422, "INVALID_IMAGE", "Файл должен быть изображением (JPEG, PNG, WEBP) до 5 МБ"));
        return;
      }
      next();
    });
  },
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError(422, "INVALID_IMAGE", "Файл не получен");
    }

    if (isSupabaseConfigured) {
      // Supabase Storage has no built-in on-the-fly transform on the Free plan, so the
      // thumbnail is generated here, in memory, exactly like the local-disk path below — just
      // uploaded as a second object instead of a second file. Same basename convention (client's
      // toThumbnailUrl() derives ".thumb.webp" from any URL's extension, Supabase's included), so
      // no client-side change is needed to find it.
      const originalKey = `${randomUUID()}${ALLOWED_MIME_TO_EXT[req.file.mimetype]}`;
      const thumbnailKey = originalKey.replace(/\.[^./]+$/, ".thumb.webp");

      let url: string;
      try {
        url = await uploadBufferToSupabase(originalKey, req.file.buffer, req.file.mimetype);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("⚠️  Supabase Storage upload failed:", err);
        throw new AppError(502, "UPLOAD_FAILED", "Не удалось загрузить изображение, попробуйте ещё раз");
      }

      try {
        const thumbnailBuffer = await generateThumbnailBuffer(req.file.buffer);
        await uploadBufferToSupabase(thumbnailKey, thumbnailBuffer, "image/webp");
      } catch (err) {
        // Best-effort — a thumbnail failure must never fail the upload itself; ProductImage.tsx
        // already falls back to the original URL whenever a thumbnail 404s.
        // eslint-disable-next-line no-console
        console.error(`⚠️  Could not generate/upload thumbnail for ${originalKey}:`, err);
      }

      res.status(201).json({ url });
      return;
    }

    try {
      await generateThumbnail(req.file.filename);
    } catch (err) {
      // Best-effort — a thumbnail failure must never fail the upload itself; ProductImage.tsx
      // already falls back to the original URL whenever a thumbnail 404s.
      // eslint-disable-next-line no-console
      console.error(`⚠️  Could not generate thumbnail for ${req.file.filename}:`, err);
    }
    res.status(201).json({ url: `${UPLOADS_URL_PREFIX}${req.file.filename}` });
  }),
);

// Lets the client clean up an image it uploaded but never attached to a product
// (dialog cancelled, replaced before saving). Refuses to touch a live product photo.
router.delete(
  "/image",
  asyncHandler(async (req, res) => {
    const { url } = deleteImageSchema.parse(req.body);

    const inUse = await prisma.product.findFirst({ where: { imageUrl: url } });
    if (inUse) {
      throw new AppError(409, "IMAGE_IN_USE", "Изображение используется товаром");
    }

    await deleteUploadedFile(url);
    res.status(204).end();
  }),
);

export default router;
