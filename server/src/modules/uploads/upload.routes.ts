import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../config/db.js";
import { AppError } from "../../middleware/error.js";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { deleteUploadedFile, imageUpload, UPLOADS_URL_PREFIX } from "../../shared/utils/uploads.js";

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
