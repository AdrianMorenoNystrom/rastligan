import { useAuth } from "../components/providers";
import { MatchForm } from "../components/MatchForm";
import { Login } from "../components/Login";
import { PageHeading } from "../components/ui";
export default function Register() {
  const auth = useAuth();
  return (
    <div className="narrow">
      <PageHeading title="Registrera match" />
      <section className="card register-card">
        {auth.checking ? (
          <p role="status">Kontrollerar inloggningen…</p>
        ) : (
          !auth.session && <Login />
        )}
        <div hidden={!auth.session}>
          <MatchForm />
        </div>
      </section>
      <p className="fine-print centered">
        Vinst 3 poäng · Oavgjort 1 poäng · Förlust 0 poäng
      </p>
    </div>
  );
}
