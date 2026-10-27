import { useAuth } from "../components/providers";
import { MatchForm } from "../components/MatchForm";
import { Login } from "../components/Login";
import { PageHeading } from "../components/ui";
export default function Register() {
  const auth = useAuth();
  return (
    <div className="narrow">
      <PageHeading eyebrow="Ett resultat i taget" title="Registrera match" />
      <section className="card register-card">
        {auth.checking ? (
          <p role="status">Kontrollerar redigerarsession…</p>
        ) : (
          !auth.session && <Login />
        )}
        <div hidden={!auth.session}>
          <MatchForm />
        </div>
      </section>
      <p className="fine-print centered">
        Varje registrering räknas som en match, oavsett antal set.
        <br />
        Vinst 3 poäng · Oavgjort 1 poäng · Förlust 0 poäng
      </p>
    </div>
  );
}
