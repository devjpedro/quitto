export class UploadError extends Error {
  readonly reason: "aborted" | "failed";
  readonly status: number;
  constructor(reason: "aborted" | "failed", status: number) {
    super(`upload ${reason}${status ? ` (${status})` : ""}`);
    this.reason = reason;
    this.status = status;
  }
}

/**
 * The PUT to the presigned URL, with real progress and a way out (planner's
 * decision 23): fetch has no upload progress, so this one call uses XHR.
 */
export function uploadWithProgress(
  url: string,
  file: File,
  onProgress: (loaded: number, total: number) => void,
  signal: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Cancelled while the presign was on its way: no PUT at all.
    if (signal.aborted) {
      reject(new UploadError("aborted", 0));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", file.type);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded, event.total);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new UploadError("failed", xhr.status));
      }
    };
    xhr.onerror = () => reject(new UploadError("failed", 0));
    xhr.onabort = () => reject(new UploadError("aborted", 0));
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}
