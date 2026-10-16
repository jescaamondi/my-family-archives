import { supabase } from "../supabaseClient";

const mediaUrlCache = new Map();
const MEDIA_BUCKETS = ["family-media", "memories"];

export async function resolveMediaUrl(value, expires = 60 * 60) {
  if (!value || typeof value !== "string") return null;
  if (value.startsWith("http")) return value;

  const now = Date.now();
  const cached = mediaUrlCache.get(value);
  if (cached && cached.expiresAt > now) return cached.url;

  for (const bucket of MEDIA_BUCKETS) {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(value, expires);

      if (!error && data?.signedUrl) {
        const expiresAt = Date.now() + Math.max(0, expires * 1000 - 5000);
        mediaUrlCache.set(value, { url: data.signedUrl, expiresAt });
        return data.signedUrl;
      }
    } catch (error) {
      console.warn(`Could not resolve media from ${bucket}`, error);
    }
  }

  return null;
}

export function isPublicUrl(value) {
  return typeof value === "string" && value.startsWith("http");
}

export function clearMediaUrlCache() {
  mediaUrlCache.clear();
}
