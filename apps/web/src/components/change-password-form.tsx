import { type FormEvent, useState } from "react";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { changePassword } from "@/lib/auth-client";

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [feedback, setFeedback] = useState<{
    kind: "ok" | "error";
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);
    if (newPassword !== confirmPassword) {
      setFeedback({ kind: "error", message: "As senhas não coincidem." });
      return;
    }
    setLoading(true);
    try {
      const { error } = await changePassword({ currentPassword, newPassword });
      if (error) {
        setFeedback({ kind: "error", message: "Senha atual incorreta." });
        return;
      }
      setFeedback({ kind: "ok", message: "Senha alterada." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="current-password">Senha atual</Label>
        <PasswordInput
          id="current-password"
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          value={currentPassword}
        />
      </div>

      <div className="grid gap-4 border-border border-t pt-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-password">Nova senha</Label>
          <PasswordInput
            id="new-password"
            minLength={8}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            value={newPassword}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm-password">Confirmar nova senha</Label>
          <PasswordInput
            id="confirm-password"
            minLength={8}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            value={confirmPassword}
          />
        </div>
      </div>

      {feedback && (
        <p
          className={
            feedback.kind === "ok"
              ? "text-primary text-sm"
              : "text-destructive text-sm"
          }
          role={feedback.kind === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </p>
      )}

      <div className="flex justify-end">
        <Button
          className="w-full transition-transform duration-[var(--dur-fast)] ease-[var(--ease-out)] active:scale-[0.97] sm:w-auto"
          disabled={loading}
          type="submit"
        >
          {loading ? "Aguarde..." : "Trocar senha"}
        </Button>
      </div>
    </form>
  );
}
