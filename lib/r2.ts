// path: maestra-vibe/lib/r2.ts  (NEW file)
// SIRF server par use karo (API routes / server actions). Kabhi client component mein import mat karna.
import { S3Client, DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// Browser is temporary link par seedha R2 mein photo upload karta hai (5 minute valid)
export async function presignUpload(key: string, contentType: string) {
  const cmd = new PutObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key, ContentType: contentType });
  return getSignedUrl(r2, cmd, { expiresIn: 300 });
}

export async function uploadObject(key: string, contentType: string, body: Uint8Array) {
  await r2.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key, ContentType: contentType, Body: body }));
}

export async function deleteObject(key: string) {
  await r2.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }));
}

export function chatMediaObjectKey(mediaUrl: string): string | null {
  const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/+$/, "");
  const prefix = publicBase ? `${publicBase}/chat-media/` : "";
  if (!prefix || !mediaUrl.startsWith(prefix)) return null;

  let key: string;
  try {
    key = `chat-media/${decodeURIComponent(mediaUrl.slice(prefix.length))}`;
  } catch {
    return null;
  }
  if (!/^chat-media\/[A-Za-z0-9._/-]+$/.test(key) || key.split("/").some((part) => part === "." || part === "..")) return null;
  return key;
}

// Upload ke baad photo dikhane ka public link
export const publicUrl = (key: string) => `${process.env.R2_PUBLIC_URL?.replace(/\/+$/, "")}/${key}`;