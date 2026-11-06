import { DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { r2 } from "@/lib/r2";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return Response.json({ error: "Chat media cleanup is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const bucket = process.env.R2_BUCKET;
  if (!bucket) return Response.json({ error: "Chat media storage is not configured." }, { status: 503 });
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  let continuationToken: string | undefined;
  let deleted = 0;

  do {
    const page = await r2.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: "chat-media/",
      ContinuationToken: continuationToken,
    }));
    const expiredKeys = (page.Contents ?? [])
      .filter((item) => item.Key?.startsWith("chat-media/") && item.LastModified && item.LastModified.getTime() <= cutoff)
      .flatMap((item) => item.Key ? [item.Key] : []);
    for (let index = 0; index < expiredKeys.length; index += 50) {
      await Promise.all(expiredKeys.slice(index, index + 50).map((Key) =>
        r2.send(new DeleteObjectCommand({ Bucket: bucket, Key }))
      ));
      deleted += expiredKeys.slice(index, index + 50).length;
    }
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);

  return Response.json({ deleted });
}
