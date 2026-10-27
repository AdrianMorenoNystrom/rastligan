# Leveransstatus

Rastligan är implementerad och verifierad lokalt mot riktig Supabase PostgreSQL, PostgREST och Edge Functions. Frontend innehåller inga exempelmatcher. Alla fyra huvudvyer, profiler, dueller, rekord, datumfilter, diagram, skrivflöden och återkalleliga kodsessioner är implementerade.

## Verifierat 2026-10-27

- TypeScript strict typecheck, ESLint och produktionsbygge.
- 64 Vitest-fall: poäng/rankning, kalender, statistik, import från CSV/XLSX och registreringskomponenten.
- 23 databasfall i PostgreSQL, inklusive verkliga anon-grants/RLS, återkallelse, 90-dagarsgräns, audit, idempotens och mer än 1 000 matcher.
- 13 HTTP-fall mot verklig lokal Supabase/Edge Function: kodinloggning, nekade REST-skrivningar, felaktiga token, parallell dubbelsparning, utloggning och rate limiting.
- 8 Playwright-fall: publika vyer och hela skapa/ändra/radera/inloggningsflödet i 375, 390, 768 och 1440 px.
- Mobil- och desktopbilder har granskats. Alla tre tabellrader ryms utan sidscrollning. Registreringen har förenklats efter granskningen.
- Bygget har genomsökts efter konfigurerade servernycklar och testkoder. npm audit rapporterar inga kända sårbarheter.
- Deno typecheck av den riktiga Edge-funktionen.

## Verklig källdata

Originalarket lästes autentiserat och ändrades inte. Källkopian behåller radpositionerna i Data-fliken. Lokal import: **7 matcher, 0 ogiltiga ifyllda rader, 593 tomma registreringsrader**. Upprepning: **7 redan importerade, 0 nya dubbletter**. Kontrollposten Dave–Elias 2–2, 2026-10-22 verifierades. Tabellen efter import: Elias 9 poäng (5 matcher), Dave 5 (4), Adrian 4 (5). Tre matcher är oavgjorda.

## Drift

GitHub Actions för kvalitet, GitHub Pages och Supabase-deployment finns. Frontend använder repository-anpassad base-sökväg och HashRouter. Servernycklar, lokala miljöfiler och testkoder är gitignorerade.

**Uppdatering 2026-10-27:** Supabase-produktionsprojektet är nu anslutet och har fått åtta matcher från en ny läsning av originalarket. Den lokala databasen har också åtta matcher. Produktionsimport och återimportkontroll är verifierade. Spelarkoder har inte ändrats vid denna import. Webbpublicering följer stegen i [README](README.md#produktionsdrift).

Egenvalda spelarkoder kan nu ändras med `set-code`, med dold inmatning och bekräftelse i terminalen. Produktionskommandona finns i README. Den ursprungliga sjumatchersfilen används fortsatt som oföränderlig testfixture i CI.

## Granskningsbilder

- [Ligan på mobil](artifacts/screenshots/ligan-mobile-375.png)
- [Ligan på desktop](artifacts/screenshots/ligan-desktop-1440.png)
- [Registrera på mobil](artifacts/screenshots/registrera-mobile-375.png)
- [Statistik på desktop](artifacts/screenshots/statistik-desktop-1440.png)

Registreringsbilder använder en tillfällig match i den isolerade testmiljön. Testmatchen har tagits bort; appens lagrade ligadata består av de sju importerade originalmatcherna.
