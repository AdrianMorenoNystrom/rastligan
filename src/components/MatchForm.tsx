import { useState, useRef } from "react";
import type { FormEvent } from "react";
import { Minus, Plus, Check, Trash2, ArrowLeft } from "lucide-react";
import { PAIRS, player, today, validateMatch, dateLabel } from "../lib/domain";
import type { Match, MatchInput, PlayerId } from "../lib/domain";
import { useAuth, useRefreshMatches } from "./providers";
import { ErrorText, Modal } from "./ui";
export function MatchForm({
  match,
  onDone,
}: {
  match?: Match;
  onDone?: () => void;
}) {
  const auth = useAuth(),
    refresh = useRefreshMatches();
  const [pair, setPair] = useState<[PlayerId, PlayerId] | null>(
    match ? [match.player1_id, match.player2_id] : null,
  );
  const [scores, setScores] = useState<[number, number]>(
    match ? [match.score1, match.score2] : [0, 0],
  );
  const [date, setDate] = useState(match?.played_on || today());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const attempt = useRef<{ key: string; payload: string } | null>(null);
  const locked = useRef(false);
  const input: MatchInput = {
    player1_id: pair?.[0] || "adrian",
    player2_id: pair?.[1] || "dave",
    score1: scores[0],
    score2: scores[1],
    played_on: date,
  };
  const invalid = validateMatch(input);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (locked.current || invalid || !pair) return;
    locked.current = true;
    setBusy(true);
    setError("");
    const payload = JSON.stringify(input);
    if (!attempt.current || attempt.current.payload !== payload)
      attempt.current = { key: crypto.randomUUID(), payload };
    try {
      await auth.request({
        action: match ? "update" : "create",
        match: {
          ...input,
          ...(match ? { id: match.id, updated_at: match.updated_at } : {}),
        },
        idempotency_key: attempt.current.key,
      });
      await refresh();
      attempt.current = null;
      setSaved(true);
      if (match) onDone?.();
      else {
        setPair(null);
        setScores([0, 0]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function remove() {
    if (locked.current || !match) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      await auth.request({
        action: "delete",
        match: { id: match.id, updated_at: match.updated_at },
      });
      await refresh();
      onDone?.();
    } catch (e) {
      setError((e as Error).message);
      setConfirm(false);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      {saved && !match && (
        <p role="status" className="notice success">
          <Check size={18} />
          Match sparad
        </p>
      )}
      {!auth.session && (
        <p className="notice error">Logga in igen för att spara.</p>
      )}
      <form onSubmit={save} className="match-form">
        <fieldset disabled={busy}>
          <legend>Spelarpar</legend>
          <div className="pair-options">
            {(match
              ? [[match.player1_id, match.player2_id] as [PlayerId, PlayerId]]
              : pair
                ? [pair]
                : PAIRS
            ).map(([a, b]) => (
              <button
                type="button"
                key={a + b}
                aria-label={`${player(a).name} mot ${player(b).name}`}
                className={`pair-option ${pair?.[0] === a && pair?.[1] === b ? "selected" : ""}`}
                aria-pressed={pair?.[0] === a && pair?.[1] === b}
                onClick={() => {
                  setPair([a, b]);
                  setScores([0, 0]);
                  setSaved(false);
                }}
                disabled={Boolean(pair) || busy}
              >
                <span>
                  <i style={{ background: player(a).color }} />
                  {player(a).name}
                </span>
                <span className="versus">mot</span>
                <span>
                  <i style={{ background: player(b).color }} />
                  {player(b).name}
                </span>
              </button>
            ))}
          </div>
        </fieldset>
        {pair && (
          <>
            <fieldset disabled={busy}>
              <legend>Vunna set</legend>
              <div className="score-controls">
                {pair.map((id, i) => (
                  <div className="score-side" key={id}>
                    <label
                      htmlFor={`score-${id}`}
                      style={{ color: player(id).color }}
                    >
                      {player(id).name}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      id={`score-${id}`}
                      aria-label={`Set för ${player(id).name}`}
                      value={Number.isNaN(scores[i]) ? "" : scores[i]}
                      onChange={(e) =>
                        setScores(
                          (s) =>
                            s.map((v, j) =>
                              j === i
                                ? e.target.value === ""
                                  ? NaN
                                  : Number(e.target.value)
                                : v,
                            ) as [number, number],
                        )
                      }
                    />
                    <div className="step-buttons">
                      <button
                        type="button"
                        aria-label={`Minska ${player(id).name}`}
                        disabled={busy || !scores[i] || scores[i] <= 0}
                        onClick={() =>
                          setScores(
                            (s) =>
                              s.map((v, j) =>
                                i === j ? Math.max(0, v - 1) : v,
                              ) as [number, number],
                          )
                        }
                      >
                        <Minus size={22} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Öka ${player(id).name}`}
                        onClick={() =>
                          setScores(
                            (s) =>
                              s.map((v, j) =>
                                i === j ? (Number.isFinite(v) ? v + 1 : 1) : v,
                              ) as [number, number],
                          )
                        }
                      >
                        <Plus size={22} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>
            <p className="fine-print score-note">
              Oavgjort är tillåtet, men inte 0–0.
            </p>
            <label htmlFor="played-on">Matchdatum</label>
            <input
              id="played-on"
              type="date"
              required
              min="0001-01-01"
              max="9999-12-31"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={busy}
            />
            <ErrorText>{error}</ErrorText>
            <button
              className="button primary full save-button"
              disabled={busy || Boolean(invalid) || !auth.session}
            >
              <Check size={20} />
              {busy ? "Sparar…" : match ? "Spara ändringar" : "Spara match"}
            </button>
            {!match && (
              <button
                type="button"
                disabled={busy}
                className="button ghost full"
                onClick={() => {
                  setPair(null);
                  setScores([0, 0]);
                  setError("");
                }}
              >
                <ArrowLeft size={17} />
                Byt spelarpar
              </button>
            )}
          </>
        )}
        {match && (
          <button
            type="button"
            disabled={busy || !auth.session}
            className="button danger full"
            onClick={() => setConfirm(true)}
          >
            <Trash2 size={17} />
            Ta bort match
          </button>
        )}
      </form>
      {confirm && match && (
        <Modal
          title="Ta bort match?"
          onClose={() => {
            if (!busy) setConfirm(false);
          }}
        >
          <p>
            {player(match.player1_id).name} – {player(match.player2_id).name},{" "}
            {match.score1}–{match.score2}
          </p>
          <p className="muted">
            {dateLabel(match.played_on)}. Matchen tas bort permanent.
          </p>
          <div className="dialog-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setConfirm(false)}
            >
              Avbryt
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={() => void remove()}
            >
              {busy ? "Tar bort…" : "Ja, ta bort"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
