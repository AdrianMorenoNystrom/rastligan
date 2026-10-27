import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, LogOut, ShieldCheck } from "lucide-react";
import { PLAYERS, player } from "../lib/domain";
import type { PlayerId } from "../lib/domain";
import { useAuth } from "./providers";
import { ErrorText } from "./ui";
export function Login({ onDone }: { onDone?: () => void }) {
  const auth = useAuth();
  const [id, setId] = useState<PlayerId>("adrian");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await auth.login(id, code);
      setCode("");
      onDone?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (auth.session)
    return (
      <div className="session-panel">
        <ShieldCheck size={32} />
        <p>
          Inloggad som <strong>{player(auth.session.player_id).name}</strong>.
        </p>
        <ErrorText>{error}</ErrorText>
        <button
          disabled={busy}
          className="button secondary full"
          onClick={async () => {
            setBusy(true);
            try {
              await auth.logout();
              onDone?.();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <LogOut size={18} />
          {busy ? "Loggar ut…" : "Logga ut"}
        </button>
      </div>
    );
  return (
    <form onSubmit={submit} className="login-form">
      <fieldset disabled={busy}>
        <legend>Spelare</legend>
        <div className="segmented">
          {PLAYERS.map((p) => (
            <button
              type="button"
              key={p.id}
              aria-pressed={id === p.id}
              className={id === p.id ? "selected" : ""}
              onClick={() => setId(p.id)}
            >
              {p.name}
            </button>
          ))}
        </div>
      </fieldset>
      <label htmlFor="editor-code">Personlig kod</label>
      <input
        autoComplete="current-password"
        id="editor-code"
        type="password"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        maxLength={72}
        required
        disabled={busy}
      />
      <ErrorText>{error}</ErrorText>
      <button className="button primary full" disabled={busy || !code.trim()}>
        {busy ? "Loggar in…" : "Logga in"}
        <ArrowRight size={19} />
      </button>
      <p className="fine-print">Du förblir inloggad på den här enheten.</p>
    </form>
  );
}
