import { todayISO } from "@quitto/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { withInstallmentPatch } from "@/features/contracts/lib/contract-cache";
import type { ContractDetail } from "@/features/contracts/types";
import { api } from "@/lib/api";
import { unwrap } from "@/lib/api-client";
import { invalidateContractViews } from "@/lib/invalidate-contract-views";
import { queryKeys } from "@/lib/query-keys";
import { m } from "@/paraglide/messages.js";
import { proofFileError } from "../lib/proof-file";
import { UploadError, uploadWithProgress } from "../lib/upload";
import type { InstallmentDetail } from "../types";

type ProofMime = "application/pdf" | "image/jpeg" | "image/png";

export type UploadState =
  | { phase: "idle" }
  | { phase: "dragging" }
  | { loaded: number; name: string; phase: "uploading"; total: number }
  | {
      error: "bad_type" | "too_large" | "empty" | "failed";
      name: string;
      phase: "error";
      size: number;
    };

const IDLE: UploadState = { phase: "idle" };

/**
 * Sending a proof (P1, P6, P7): validate, presign, PUT with progress, then
 * record it. A cancel aborts the PUT and returns to the drop zone; leaving
 * the page mid-upload asks the browser to confirm (beforeunload). The state
 * is marked with its installment (the panel does not remount on a step,
 * planner's decision 34), so another installment reads it as idle, and
 * moving to another one aborts the previous one's upload. Any stop but the
 * drop zone's own "Cancelar" (the panel closing, the phone's Back, another
 * installment, leaving the contract) says so in a toast: a proof is never
 * dropped in silence (review I2).
 */
export function useProofUpload(contractId: string, installmentId: string) {
  const qc = useQueryClient();
  const [held, setHeld] = useState({ id: installmentId, state: IDLE });
  const state = held.id === installmentId ? held.state : IDLE;
  const flight = useRef<{
    abort: AbortController;
    id: string;
    name: string;
    /** The PUT is done and the proof is being recorded: that POST runs to its end. */
    recording: boolean;
  } | null>(null);

  const abortFlight = useCallback((announce: boolean) => {
    const current = flight.current;
    if (!current || current.recording || current.abort.signal.aborted) {
      return;
    }
    current.abort.abort();
    if (announce) {
      toast.warning(m.panel_toast_proof_stopped(), {
        description: m.panel_toast_proof_stopped_hint({ name: current.name }),
      });
    }
  }, []);

  useEffect(() => {
    if (flight.current && flight.current.id !== installmentId) {
      abortFlight(true);
    }
  }, [abortFlight, installmentId]);

  // Leaving the contract (the panel unmounts) stops the PUT too.
  useEffect(() => () => abortFlight(true), [abortFlight]);

  useEffect(() => {
    if (state.phase !== "uploading") {
      return;
    }
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state.phase]);

  const pick = useCallback(
    async (file: File) => {
      if (flight.current) {
        return;
      }
      const id = installmentId;
      const set = (next: UploadState) => setHeld({ id, state: next });
      const invalid = proofFileError(file);
      if (invalid) {
        set({
          phase: "error",
          name: file.name,
          size: file.size,
          error: invalid,
        });
        return;
      }
      const abort = new AbortController();
      const current = { abort, id, name: file.name, recording: false };
      flight.current = current;
      set({ phase: "uploading", name: file.name, loaded: 0, total: file.size });
      try {
        const mimeType = file.type as ProofMime;
        const proofs = api.api.installments({ installmentId: id }).proofs;
        const presign = await unwrap(
          proofs.presign.post({ fileName: file.name, mimeType })
        );
        await uploadWithProgress(
          presign.uploadUrl,
          file,
          (loaded, total) =>
            set({ phase: "uploading", name: file.name, loaded, total }),
          abort.signal
        );
        if (abort.signal.aborted) {
          // Cancelled between the PUT's end and the record: nothing is recorded.
          throw new UploadError("aborted", 0);
        }
        current.recording = true;
        const entity = await unwrap(
          proofs.post({
            objectKey: presign.objectKey,
            fileName: file.name,
            mimeType,
          })
        );
        qc.setQueryData<ContractDetail>(
          queryKeys.contract(contractId),
          (detail) =>
            detail &&
            withInstallmentPatch(detail, entity.id, entity, todayISO())
        );
        // The panel reads the installment's own cache: patch it now, or the
        // P1 (the drop zone, the pinned "Enviar comprovante") shows again until
        // the refetch comes back, and invites a second send.
        qc.setQueryData<InstallmentDetail>(
          queryKeys.installment(id),
          (detail) =>
            detail && {
              ...detail,
              status: entity.status,
              paidAt: entity.paidAt,
              confirmedAt: entity.confirmedAt,
            }
        );
        toast.success(m.panel_toast_proof_sent());
        set(IDLE);
      } catch (error) {
        if (error instanceof UploadError && error.reason === "aborted") {
          set(IDLE);
          return;
        }
        set({
          phase: "error",
          name: file.name,
          size: file.size,
          error: "failed",
        });
      } finally {
        flight.current = null;
        qc.invalidateQueries({ queryKey: queryKeys.installment(id) });
        invalidateContractViews(qc, contractId);
      }
    },
    [contractId, installmentId, qc]
  );

  /** The drop zone's "Cancelar": the user sees the zone come back, nothing to say. */
  const cancel = useCallback(() => abortFlight(false), [abortFlight]);
  /** The panel let the proof go (closed, Back, another installment): said in a toast. */
  const stop = useCallback(() => abortFlight(true), [abortFlight]);
  const setDragging = useCallback(
    (on: boolean) =>
      setHeld((current) => {
        const now = current.id === installmentId ? current.state : IDLE;
        if (now.phase === "uploading") {
          return current;
        }
        return { id: installmentId, state: on ? { phase: "dragging" } : IDLE };
      }),
    [installmentId]
  );
  return useMemo(
    () => ({ state, pick, cancel, stop, setDragging }),
    [state, pick, cancel, stop, setDragging]
  );
}
