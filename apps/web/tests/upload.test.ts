import { afterEach, describe, expect, it, vi } from "vitest";
import {
  UploadError,
  uploadWithProgress,
} from "@/features/installments/lib/upload";
import { FakeXhr } from "./fake-xhr";

const file = new File(["%PDF-1.4"], "pix-carlos-outubro.pdf", {
  type: "application/pdf",
});

describe("uploadWithProgress", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("PUT com o tipo do arquivo, o progresso real e resolve no 2xx", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    const onProgress = vi.fn();
    const done = uploadWithProgress(
      "https://s3.local/put",
      file,
      onProgress,
      new AbortController().signal
    );
    const xhr = FakeXhr.last;
    expect(xhr.method).toBe("PUT");
    expect(xhr.headers["content-type"]).toBe("application/pdf");
    xhr.upload.onprogress?.({
      lengthComputable: true,
      loaded: 217_088,
      total: 337_920,
    });
    expect(onProgress).toHaveBeenCalledWith(217_088, 337_920);
    xhr.status = 200;
    xhr.onload?.();
    await expect(done).resolves.toBeUndefined();
  });

  it("cancelar aborta o PUT e rejeita com 'aborted'; erro do storage rejeita com 'failed'", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    const controller = new AbortController();
    const aborted = uploadWithProgress(
      "https://s3.local/put",
      file,
      vi.fn(),
      controller.signal
    );
    controller.abort();
    await expect(aborted).rejects.toMatchObject({ reason: "aborted" });
    const failed = uploadWithProgress(
      "https://s3.local/put",
      file,
      vi.fn(),
      new AbortController().signal
    );
    FakeXhr.last.status = 403;
    FakeXhr.last.onload?.();
    await expect(failed).rejects.toBeInstanceOf(UploadError);
  });
});
