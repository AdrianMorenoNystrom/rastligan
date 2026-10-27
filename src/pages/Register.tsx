import { useAuth } from "../components/providers";
import { BreakForm } from "../components/BreakForm";
import { Login } from "../components/Login";
import { PageHeading } from "../components/ui";
export default function Register() {
  const auth = useAuth();
  return (
    <div className="narrow">
      <PageHeading title="Registrera rast" />
      <section className="card register-card">
        {auth.checking ? (
          <p role="status">Kontrollerar inloggningen…</p>
        ) : (
          !auth.session && <Login />
        )}
        <div hidden={!auth.session}>
          <BreakForm />
        </div>
      </section>
      <p className="fine-print centered">
        Vinst 3 poäng · Oavgjort 1 poäng · Förlust 0 poäng
      </p>
    </div>
  );
}
