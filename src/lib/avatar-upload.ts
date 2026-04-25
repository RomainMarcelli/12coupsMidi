"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Upload de l'avatar côté client (contourne la limite 1 MB des Server Actions).
 *
 * Étapes :
 *  1. Redimensionne l'image à 512×512 (cover) sur un <canvas>.
 *  2. Compresse en WebP qualité 0.85 (fallback JPEG si WebP indispo).
 *  3. Upload dans le bucket Supabase `avatars` à `{userId}/avatar.webp`.
 *  4. Renvoie l'URL publique.
 *
 * Le composant appelant fait ensuite un `saveProfile({ avatarUrl })` (payload
 * minuscule, pas de souci avec la limite Next.js).
 */

export interface UploadAvatarResult {
  status: "ok";
  url: string;
}

export interface UploadAvatarError {
  status: "error";
  message: string;
}

const MAX_DIMENSION = 512;
const TARGET_QUALITY = 0.85;

export async function uploadAvatarClient(
  file: File,
): Promise<UploadAvatarResult | UploadAvatarError> {
  if (!file.type.startsWith("image/")) {
    return { status: "error", message: "Le fichier doit être une image." };
  }

  let blob: Blob;
  try {
    blob = await compressToSquare(file, MAX_DIMENSION, TARGET_QUALITY);
  } catch (e) {
    return {
      status: "error",
      message:
        e instanceof Error ? e.message : "Échec de la préparation de l'image.",
    };
  }

  const supabase = createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return { status: "error", message: "Session expirée — reconnecte-toi." };
  }

  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  // Cache-buster via timestamp pour forcer le re-fetch après update.
  const path = `${user.id}/avatar-${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, blob, {
      contentType: blob.type,
      cacheControl: "3600",
      upsert: true,
    });

  if (upErr) {
    return { status: "error", message: upErr.message };
  }

  const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
  return { status: "ok", url: pub.publicUrl };
}

/**
 * Resize + compresse une image vers un canvas carré `size`×`size` en WebP.
 * Cadre l'image en "cover" (centre, on garde le ratio sans déformer).
 */
async function compressToSquare(
  file: File,
  size: number,
  quality: number,
): Promise<Blob> {
  const dataUrl = await readAsDataURL(file);
  const img = await loadImage(dataUrl);

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas non supporté.");

  // Scale "cover" : on remplit le carré sans déformer.
  const ratio = Math.max(size / img.width, size / img.height);
  const drawW = img.width * ratio;
  const drawH = img.height * ratio;
  const dx = (size - drawW) / 2;
  const dy = (size - drawH) / 2;
  ctx.drawImage(img, dx, dy, drawW, drawH);

  // Tente WebP, fallback JPEG si pas supporté.
  const webp = await canvasToBlob(canvas, "image/webp", quality);
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await canvasToBlob(canvas, "image/jpeg", quality);
  if (jpeg) return jpeg;
  throw new Error("Compression impossible.");
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(new Error("Lecture du fichier échouée."));
    r.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image illisible."));
    img.src = dataUrl;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), mime, quality);
  });
}
