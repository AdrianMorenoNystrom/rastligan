import { useState } from "react";
import { SlidersHorizontal, RotateCw } from "lucide-react";
import { PLAYERS, PAIRS, player, newest, within } from "../lib/domain";
import type { Match } from "../lib/domain";
import { useMatches, useAuth } from "../components/providers";
import { PageHeading, Modal, ErrorText } from "../components/ui";
import { MatchList } from "../components/MatchList";
import { MatchForm } from "../components/MatchForm";
import { Login } from "../components/Login";
export default function History() {
  const query = useMatches();
  const auth = useAuth();
  const [who, setWho] = useState("all");
  const [pair, setPair] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Match | null>(null);
  const badRange = Boolean(from && to && from > to);
  const filtered = (query.data || [])
    .filter(
      (m) =>
        (who === "all" || m.player1_id === who || m.player2_id === who) &&
        (pair === "all" || `${m.player1_id}-${m.player2_id}` === pair) &&
        within(m, { from, to }),
    )
    .sort(newest);
  const pages = Math.max(1, Math.ceil(filtered.length / 25));
  const current = Math.min(page, pages);
  return (
    <>
      <PageHeading eyebrow="Hela matchhistoriken" title="Matcher">
        <span className="tag">{filtered.length} matcher</span>
      </PageHeading>
      <section className="card filters">
        <div className="filter-heading">
          <SlidersHorizontal size={17} />
          <h2>Filtrera matcher</h2>
          <button
            onClick={() => {
              setWho("all");
              setPair("all");
              setFrom("");
              setTo("");
              setPage(1);
            }}
            className="text-link"
          >
            Rensa
          </button>
        </div>
        <div className="filter-grid">
          <label>
            Spelare
            <select
              value={who}
              onChange={(e) => {
                setWho(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">Alla spelare</option>
              {PLAYERS.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Spelarpar
            <select
              value={pair}
              onChange={(e) => {
                setPair(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">Alla spelarpar</option>
              {PAIRS.map(([a, b]) => (
                <option key={a + b} value={`${a}-${b}`}>
                  {player(a).name} – {player(b).name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Från datum
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            Till datum
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>
        <ErrorText>
          {badRange
            ? "Startdatum måste vara före eller samma som slutdatum."
            : ""}
        </ErrorText>
      </section>
      <section className="card history-card">
        {!badRange && (
          <MatchList
            matches={filtered.slice((current - 1) * 25, current * 25)}
            onEdit={auth.session ? setEditing : undefined}
          />
        )}
        <div className="history-footer">
          <span>Samma datum innebär ingen känd spelordning.</span>
          <button
            className="icon-button"
            onClick={() => void query.refetch()}
            aria-label="Uppdatera matchhistoriken"
          >
            <RotateCw size={17} />
          </button>
        </div>
      </section>
      {pages > 1 && (
        <nav className="pagination" aria-label="Sidor i matchhistoriken">
          <button
            className="button secondary"
            disabled={current === 1}
            onClick={() => setPage(current - 1)}
          >
            Föregående
          </button>
          <span>
            {current} / {pages}
          </span>
          <button
            className="button secondary"
            disabled={current === pages}
            onClick={() => setPage(current + 1)}
          >
            Nästa
          </button>
        </nav>
      )}
      {editing && (
        <Modal title="Redigera match" onClose={() => setEditing(null)}>
          {!auth.session && <Login />}
          <MatchForm match={editing} onDone={() => setEditing(null)} />
          <button
            className="button ghost full"
            onClick={async () => {
              const result = await query.refetch();
              const fresh = result.data?.find((m) => m.id === editing.id);
              if (fresh) setEditing(fresh);
              else setEditing(null);
            }}
          >
            Hämta aktuell version
          </button>
        </Modal>
      )}
    </>
  );
}
