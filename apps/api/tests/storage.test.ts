import { beforeAll, describe, expect, it } from "bun:test";
import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "../src/env";
import { deleteObjects, headObject, presignUpload } from "../src/lib/storage";

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
    const url = await presignUpload(key, "text/plain", 5);
    const put = await fetch(url, {
      method: "PUT",
      headers: { "content-type": "text/plain" },
      body: "hello",
    });
    expect(put.ok).toBe(true);
    const head = await headObject(key);
    expect(head.ContentLength).toBe(5);
  });

  it("removes objects from the bucket", async () => {
    const key = `test/lgpd/${crypto.randomUUID()}.txt`;
    const url = await presignUpload(key, "text/plain", 1);
    await fetch(url, {
      method: "PUT",
      headers: { "content-type": "text/plain" },
      body: "x",
    });
    await headObject(key);
    await deleteObjects([key]);
    await expect(headObject(key)).rejects.toBeDefined();
  });
});

describe.if(configured)("presign assina o tamanho e o tipo", () => {
  beforeAll(ensureBucket);

  it("expira em 60s e assina content-length e content-type", async () => {
    const url = new URL(
      await presignUpload(
        `test/sig/${crypto.randomUUID()}.txt`,
        "text/plain",
        5
      )
    );
    expect(url.searchParams.get("X-Amz-Expires")).toBe("60");
    const signed = url.searchParams.get("X-Amz-SignedHeaders") ?? "";
    expect(signed).toContain("content-length");
    expect(signed).toContain("content-type");
  });

  it("aceita o PUT com o tamanho certo", async () => {
    const url = await presignUpload(
      `test/sig/${crypto.randomUUID()}.txt`,
      "text/plain",
      5
    );
    const put = await fetch(url, {
      method: "PUT",
      headers: { "content-type": "text/plain" },
      body: "hello",
    });
    expect(put.status).toBe(200);
  });

  it("recusa o PUT com corpo maior ou menor que o assinado (403)", async () => {
    for (const body of ["hello world", "hi"]) {
      const url = await presignUpload(
        `test/sig/${crypto.randomUUID()}.txt`,
        "text/plain",
        5
      );
      const put = await fetch(url, {
        method: "PUT",
        headers: { "content-type": "text/plain" },
        body,
      });
      expect(put.status).toBe(403);
    }
  });
});

describe("deleteObjects", () => {
  it("is a no-op for an empty list", async () => {
    await deleteObjects([]);
    expect(true).toBe(true);
  });
});
