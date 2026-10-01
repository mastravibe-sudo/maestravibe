// path: maestra-vibe/lib/r2.ts  (NEW file)
// SIRF server par use karo (API routes / server actions). Kabhi client component mein import mat karna.
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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

// Upload ke baad photo dikhane ka public link
export const publicUrl = (key: string) => `${process.env.R2_PUBLIC_URL}/${key}`;