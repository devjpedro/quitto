import { beforeAll, describe, expect, it } from "bun:test";
import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "../src/env";
import { headObject, presignUpload } from "../src/lib/storage";

const configured = Boolean(env.S3_ENDPOINT && env.S3_BUCKET);

async function ensureBucket() {
  const c = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID as string,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY as string,
    },
    forcePathStyle: true,
  });
  try {
    await c.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET as string }));
  } catch {
    // bucket já existe — ok
  }
}

describe.if(configured)("storage (MinIO)", () => {
  beforeAll(ensureBucket);

  it("presigns, uploads via PUT and confirms with head", async () => {
    const key = `test/${Date.now()}.txt`;
    const url = await presignUpload(key, "text/plain");
    const put = await fetch(url, {
      method: "PUT",
      headers: { "content-type": "text/plain" },
      body: "hello",
    });
    expect(put.ok).toBe(true);
    const head = await headObject(key);
    expect(head.ContentLength).toBe(5);
  });
});
