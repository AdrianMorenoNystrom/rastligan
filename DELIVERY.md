# Leveransstatus

Rastligan använder raster för registrering, ligapoäng och historik. Individuella matcher räknas separat från rastens resultat. Design, navigationens struktur och kodinloggning är bevarade.

## Rastmodellen, 2026-10-27

- En `BreakSession` är en rast. `score1`/`score2` är vunna individuella matcher: 4–1 ger en rast, fem matcher och tre ligapoäng till rastvinnaren.
- Ligatabellen visar R, V, O, F, P och P/R. Ranking: totalpoäng, matchskillnad, vunna matcher och därefter delad placering.
- Översikt, profiler, dueller och rekord skiljer rastmått från matchmått. Aktivitetsdiagrammet växlar mellan raster och matcher. Profildiagrammet har P/R, rastvinstprocent, matchvinstprocent, matchskillnad/rast och matchvinster/rast.
- Prestationsrekord kräver fem raster per spelare och kalendermånad. Volymrekord och enskilda rastrekord har ingen sådan gräns.
- Migration `202610270005_break_domain.sql` lägger till `break_snapshot()` och dokumenterar resultatens betydelse. Den befintliga tabellen `matches` och äldre RPC-format behålls. Inga poster, ID:n, importreferenser, auditloggar, koder eller sessioner skrivs om.
- Sheets-källans äldre kolumnnamn Set 1/Set 2 tolkas som matchvinster. En giltig källrad ger en rast. Importens rapporter använder `break` och `total_breaks`.

## Verifierat lokalt

- TypeScript, ESLint, produktionsbygge och kontroll av att servernycklar/testkoder saknas i bygget.
- 74 Vitest-fall, inklusive exemplet 4–1 och 2–3: två raster, tio matcher, 1,50 P/R, 60 % matchvinstprocent och +1,00 matchskillnad per rast.
- 31 PostgreSQL-kontroller i en återställd transaktion, inklusive bevarande vid migrering, RLS/grants, kodsessioner, audit, idempotens, import och komplett snapshot över 1 000 raster.
- 14 HTTP-kontroller mot lokal Supabase/Edge, inklusive nya och äldre klientformat, nekad anonym skrivning, 0–0, kodinloggning, utloggning och rate limiting.
- 8 Playwright-fall i 375, 390, 768 och 1440 px. Registrering, ändring, borttagning, datumfilter, diagram och separat rast-/matchaktivitet kontrolleras.
- Registrering, ligatabell, profiler och statistik har granskats visuellt. Alla tre spelare ryms i mobiltabellen. Aktivitetsstaplar börjar på noll.
- Återimport av den fasta källfilen: sju redan importerade, noll nya eller ändrade. Den lokala ligans åtta raster är bevarade och innehåller 33 individuella matcher. Temporära E2E-raster tas bort av testerna.

## Data och drift

Produktionsprojekt: `hsviguboptbsivvotoxp`. Webbplats: [Rastligan](https://adrianmorenonystrom.github.io/rastligan/). Rastmigreringen och Edge-funktionen är uppgraderade. Före/efterkontrollen verifierade oförändrade åtta raster, 33 matcher och åtta importreferenser, inklusive ID:n, datum och resultat. Frontend publiceras via Quality → GitHub Pages. Uppgraderingsordning: databas, Edge Function, frontend. Kör aldrig databasreset för denna uppgradering.

Den versionshanterade sjurastersfilen `data/source-google-sheets.json` är ett fast CI-underlag. Senare import har gett åtta raster i lokal- och produktionsligan. Källrader ändras inte av importen. Koder kan väljas med `set-code`, med stjärnor under inmatningen; alla icke-tomma längder accepteras.

## Granskningsbilder

- [Ligan på mobil](artifacts/screenshots/ligan-mobile-375.png)
- [Registrera på mobil](artifacts/screenshots/registrera-mobile-375.png)
- [Spelarprofil på mobil](artifacts/screenshots/profil-mobile-375.png)
- [Statistik på desktop](artifacts/screenshots/statistik-desktop-1440.png)
