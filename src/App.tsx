import { useState, lazy, Suspense } from "react";
import {
  HashRouter,
  NavLink,
  Routes,
  Route,
  Link,
  Navigate,
} from "react-router-dom";
import {
  Trophy,
  List,
  CirclePlus,
  ChartNoAxesCombined,
  KeyRound,
  ShieldCheck,
  Circle,
  AlertCircle,
} from "lucide-react";
import { useAuth, useMatches } from "./components/providers";
import { DataBoundary, Modal } from "./components/ui";
import { Login } from "./components/Login";
import { player } from "./lib/domain";
import League from "./pages/League";
const History = lazy(() => import("./pages/History"));
const Register = lazy(() => import("./pages/Register"));
const Statistics = lazy(() => import("./pages/Statistics"));
const links = [
  { to: "/", label: "Ligan", icon: Trophy },
  { to: "/matcher", label: "Matcher", icon: List },
  { to: "/registrera", label: "Registrera", icon: CirclePlus },
  { to: "/statistik", label: "Statistik", icon: ChartNoAxesCombined },
];
function Shell() {
  const [login, setLogin] = useState(false);
  const auth = useAuth();
  const query = useMatches();
  return (
    <>
      <a
        href="#main"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        Hoppa till innehållet
      </a>
      <header className="app-header">
        <div className="header-inner">
          <Link to="/" className="brand" aria-label="Rastligan, till ligan">
            <span className="brand-mark">
              <span />
              <i />
            </span>
            Rastligan<span className="brand-period">.</span>
          </Link>
          <nav className="desktop-nav" aria-label="Huvudnavigation">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink to={to} key={to} end={to === "/"}>
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="header-tools">
            {query.isFetching && (
              <Circle
                size={7}
                className="fetch-dot"
                aria-label="Uppdaterar data"
              />
            )}
            <button
              className={`editor-button ${auth.session ? "is-editor" : ""}`}
              onClick={() => setLogin(true)}
            >
              {auth.session ? (
                <ShieldCheck size={16} />
              ) : (
                <KeyRound size={16} />
              )}
              <span>
                {auth.checking
                  ? "Kontrollerar…"
                  : auth.session
                    ? player(auth.session.player_id).name
                    : "Redigerarläge"}
              </span>
            </button>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="main-content">
        {auth.error && (
          <p role="alert" className="notice error">
            <AlertCircle size={17} />
            {auth.error}
            <button onClick={auth.refresh}>Försök igen</button>
          </p>
        )}
        <Suspense fallback={<p role="status">Laddar vyn…</p>}>
          <Routes>
            <Route
              path="/"
              element={
                <DataBoundary>
                  <League />
                </DataBoundary>
              }
            />
            <Route
              path="/matcher"
              element={
                <DataBoundary>
                  <History />
                </DataBoundary>
              }
            />
            <Route path="/registrera" element={<Register />} />
            <Route
              path="/statistik/:section?/:id?"
              element={
                <DataBoundary>
                  <Statistics />
                </DataBoundary>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      <nav className="mobile-nav" aria-label="Mobilnavigation">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === "/"}>
            <Icon size={22} strokeWidth={1.7} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      {login && (
        <Modal
          title={auth.session ? "Redigerarläge" : "Logga in"}
          onClose={() => setLogin(false)}
        >
          <Login onDone={() => setLogin(false)} />
        </Modal>
      )}
    </>
  );
}
export default function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}
