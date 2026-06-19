import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword } from "@/lib/auth-client";

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [feedback, setFeedback] = useState<{
    kind: "ok" | "error";
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);
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
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <div className="space-y-1">
        <Label htmlFor="current-password">Senha atual</Label>
        <Input
          id="current-password"
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          type="password"
          value={currentPassword}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="new-password">Nova senha</Label>
        <Input
          id="new-password"
          minLength={8}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          type="password"
          value={newPassword}
        />
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
      <Button disabled={loading} type="submit">
        {loading ? "Aguarde..." : "Trocar senha"}
      </Button>
    </form>
  );
}
