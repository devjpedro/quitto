import {
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
