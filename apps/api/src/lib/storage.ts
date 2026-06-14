import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  type HeadObjectCommandOutput,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../env";

function requireConfig() {
  const {
    S3_ENDPOINT,
    S3_REGION,
    S3_BUCKET,
    S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY,
  } = env;
  if (
    !(
      S3_ENDPOINT &&
      S3_REGION &&
      S3_BUCKET &&
      S3_ACCESS_KEY_ID &&
      S3_SECRET_ACCESS_KEY
    )
  ) {
    throw new Error("Storage não configurado: defina as variáveis S3_*");
  }
  return {
    S3_ENDPOINT,
    S3_REGION,
    S3_BUCKET,
    S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY,
  };
}

let client: S3Client | null = null;
function s3(): { client: S3Client; bucket: string } {
  const cfg = requireConfig();
  if (!client) {
    client = new S3Client({
      endpoint: cfg.S3_ENDPOINT,
      region: cfg.S3_REGION,
      credentials: {
        accessKeyId: cfg.S3_ACCESS_KEY_ID,
        secretAccessKey: cfg.S3_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true, // necessário para MinIO
    });
  }
  return { client, bucket: cfg.S3_BUCKET };
}

/** Presigned PUT URL for the browser to upload directly. Expires in 5 min. */
export function presignUpload(
  objectKey: string,
  contentType: string
): Promise<string> {
  const { client: c, bucket } = s3();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ContentType: contentType,
  });
  return getSignedUrl(c, command, { expiresIn: 300 });
}

/** Reads object metadata; throws if the object does not exist. */
export function headObject(
  objectKey: string
): Promise<HeadObjectCommandOutput> {
  const { client: c, bucket } = s3();
  return c.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }));
}

/** Presigned GET URL for download (private bucket). Expires in 5 min. */
export function presignDownload(objectKey: string): Promise<string> {
  const { client: c, bucket } = s3();
  return getSignedUrl(
    c,
    new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
    { expiresIn: 300 }
  );
}

const DELETE_BATCH = 1000;

/** Deletes objects from the bucket in batches. No-op for an empty list. Throws on a request-level AWS error; per-key failures (returned in the response `Errors`) are not surfaced. */
export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) {
    return;
  }
  const { client: c, bucket } = s3();
  for (let i = 0; i < keys.length; i += DELETE_BATCH) {
    const batch = keys.slice(i, i + DELETE_BATCH);
    await c.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: batch.map((Key) => ({ Key })) },
      })
    );
  }
}
