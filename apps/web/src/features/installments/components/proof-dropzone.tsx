import {
  ArrowDown,
  FileImage,
  FilePdf,
  UploadSimple,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import type { DragEvent } from "react";
import { buttonVariants } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import type { UploadState } from "../hooks/use-proof-upload";
import { formatFileSize } from "../lib/file-size";
import { PANEL_TONE, type PanelMode, usePanel } from "./panel-context";

const PDF_RE = /\.pdf$/i;
const PROGRESS_NAME_ID = "upload-progress-name";

type Failed = Extract<UploadState, { phase: "error" }>;

/** "IMG_2231.heic não é aceito…": the sentence after the file's name. */
function errorSentence(state: Failed): string {
  switch (state.error) {
    case "bad_type":
      return m.panel_upload_bad_type();
    case "too_large":
      return m.panel_upload_too_large({
        size: formatFileSize(state.size, getLocale()),
      });
    case "empty":
      return m.panel_upload_empty();
    default:
      return m.panel_upload_failed();
  }
}

/** P7 (mockup 14, frame G): the file on its way, real progress, and a way out. */
function UploadProgress({
  mode,
  state,
}: {
  mode: PanelMode;
  state: Extract<UploadState, { phase: "uploading" }>;
}) {
  const { upload } = usePanel();
  const tone = PANEL_TONE[mode];
  const locale = getLocale();
  const percent =
    state.total > 0 ? Math.round((state.loaded / state.total) * 100) : 0;
  const KindIcon = PDF_RE.test(state.name) ? FilePdf : FileImage;
  return (
    <div
      className={cn("flex items-center gap-3 rounded-card p-3.5", tone.block)}
      data-testid="upload-progress"
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-control text-ink",
          tone.inner
        )}
      >
        <KindIcon size={19} />
      </span>
      <div className="min-w-0 flex-1">
        <span
          className="block truncate font-medium text-[13.5px] text-ink"
          id={PROGRESS_NAME_ID}
        >
          {state.name}
        </span>
        <span className="block text-ink-muted text-xs tabular-nums">
          {m.panel_upload_progress({
            loaded: formatFileSize(state.loaded, locale),
            total: formatFileSize(state.total, locale),
            percent,
          })}
        </span>
        <div
          aria-labelledby={PROGRESS_NAME_ID}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={percent}
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-track"
          role="progressbar"
        >
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-200 motion-reduce:transition-none"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
      <button
        aria-label={m.panel_upload_cancel()}
        className={cn(
          buttonVariants({ size: "sm", variant: "inset" }),
          "w-11 px-0 md:w-9",
          tone.innerButton
        )}
        onClick={upload.cancel}
        type="button"
      >
        <X aria-hidden="true" size={16} />
      </button>
    </div>
  );
}

/**
 * The drop zone: a button that opens the file chooser, and a target for a
 * dragged file. Dragging over it, it says "Solte para enviar"; a refused
 * file rings it in danger and says why under it, and it still takes another.
 */
function DropArea({ mode }: { mode: PanelMode }) {
  const { chooseFile, tryLock, upload } = usePanel();
  const { state } = upload;
  const over = state.phase === "dragging";
  const failed = state.phase === "error" ? state : null;
  const enter = (event: DragEvent) => {
    event.preventDefault();
    upload.setDragging(true);
  };
  return (
    <>
      <button
        className={cn(
          "flex w-full items-center gap-3.5 rounded-card border-[1.5px] border-dashed p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
          over && "border-brand bg-brand-subtle/70",
          failed && "border-danger",
          !(over || failed) && "border-line-strong hover:bg-ink/[0.03]"
        )}
        onClick={() => {
          if (tryLock()) {
            chooseFile();
          }
        }}
        onDragEnter={enter}
        onDragLeave={() => upload.setDragging(false)}
        onDragOver={enter}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files[0];
          if (file) {
            upload.pick(file);
          } else {
            upload.setDragging(false);
          }
        }}
        type="button"
      >
        <IconTile
          className={
            over
              ? "bg-brand text-surface"
              : cn(PANEL_TONE[mode].block, "text-ink")
          }
          icon={over ? ArrowDown : UploadSimple}
          tone="neutral"
        />
        <span className="min-w-0">
          <span className="block font-medium text-ink text-sm leading-[1.35]">
            {over ? (
              m.panel_drop_release()
            ) : (
              <>
                {m.panel_drop_title()}{" "}
                <u className="decoration-1 underline-offset-[3px]">
                  {m.panel_drop_choose()}
                </u>
              </>
            )}
          </span>
          <span className="mt-0.5 block text-[12.5px] text-ink-muted">
            {m.panel_drop_limit()}
          </span>
        </span>
      </button>
      {failed ? (
        <p
          className="mt-2.5 flex gap-2 text-[13px] text-danger leading-[1.45]"
          role="alert"
        >
          <WarningCircle
            aria-hidden="true"
            className="mt-px shrink-0"
            size={16}
          />
          <span>
            <b className="font-semibold">{failed.name}</b>{" "}
            {errorSentence(failed)}
          </span>
        </p>
      ) : null}
    </>
  );
}

/**
 * "Depois de pagar" and "Reenviar comprovante" (mockup 14, P1, P6 and P7).
 * In the bottom sheet the send is pinned in the footer, so the zone shows
 * only once there is something to see: the progress or the refusal.
 */
export function ProofDropzone({
  mode,
  title,
}: {
  mode: PanelMode;
  title: string;
}) {
  const { upload } = usePanel();
  const { state } = upload;
  const resting = state.phase === "idle" || state.phase === "dragging";
  if (mode === "bottom" && resting) {
    return null;
  }
  return (
    <div data-testid="proof-dropzone">
      <h3 className="mb-2 font-semibold text-[13px] text-ink">{title}</h3>
      {state.phase === "uploading" ? (
        <UploadProgress mode={mode} state={state} />
      ) : (
        <DropArea mode={mode} />
      )}
    </div>
  );
}
