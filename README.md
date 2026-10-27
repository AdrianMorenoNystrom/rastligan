# Rastligan

[Repository på GitHub](https://github.com/AdrianMorenoNystrom/rastligan) · [Verifierad leveransstatus](DELIVERY.md)

Mobilanpassad pingisliga för Adrian, Dave och Elias. Publik ligatabell, rasthistorik, spelarprofiler, dueller och interaktiva diagram. Personliga koder ger samma rätt att skapa, ändra och ta bort raster. Vunnen rast ger 3 poäng, oavgjord rast 1.

React, strikt TypeScript, Vite, Tailwind CSS, Lucide, Recharts, TanStack Query och HashRouter. Supabase PostgreSQL och en Edge Function hanterar alla skrivningar. Ingen Node-server behövs för produktionsfrontend.

## Kom igång

Kräver Node 22.12+, npm, Docker och Supabase CLI 2.104+. Kör från projektmappen. I Windows PowerShell kan `npm.cmd` / `supabase.cmd` behövas för att argument efter `--` ska vidarebefordras korrekt.

```sh
npm ci
supabase start -x studio,imgproxy,realtime,storage-api,gotrue,mailpit,postgres-meta,logflare,vector,supavisor
npm run local:configure
supabase migration up --local
```

Portar: API 55431, PostgreSQL 55432, frontend 5173. De skiljer sig från Supabases standardportar så andra lokala projekt kan fortsätta köras. `local:configure` skriver endast ignorerade `.env.local` och `supabase/.env.local`, vägrar skriva över en befintlig frontendkonfiguration och läser projektets verkliga lokala nycklar utan att skriva ut dem.

Starta sedan i varsin terminal:

```sh
npm run backend:serve
npm run dev
```

Öppna `http://127.0.0.1:5173/`. Utan ansluten databas visas ett tydligt anslutningsfel; inga låtsasraster används. Stoppa enbart detta projekts databas med `supabase stop --project-id rastligan`.

## Koder och sessioner

Med `SUPABASE_URL` och `SUPABASE_SERVICE_ROLE_KEY` i den ignorerade `.env.local`:

```sh
npm run admin -- bootstrap
npm run admin -- code adrian
npm run admin -- set-code adrian
npm run admin -- revoke dave
npm run admin -- disable elias
npm run admin -- enable elias
```

Bootstrap skapar tre kryptografiskt slumpade koder i en transaktion och vägrar köras om credentials redan finns. `code` genererar en ny kod och återkallar spelarens sessioner. Koder skrivs bara i terminalen: förvara dem i lösenordshanterare och dela privat med respektive spelare. De ska aldrig läggas i Git eller frontendmiljön.

`set-code` låter dig välja kod själv: skriv den två gånger i PowerShell eller Windows Terminal. Stjärnor visas medan du skriver; tryck Enter efter varje inmatning. Backsteg fungerar och Ctrl+C avbryter utan att ändra koden. Alla icke-tomma koder fungerar, utan minimi- eller maxlängd i appen. Kommandot visar vilken databas och spelare det gäller men skriver aldrig ut din kod. Kodbyte återkallar spelarens befintliga sessioner. Ange inte koden som ett kommandoradsargument.

För ditt produktionsprojekt, använd den separata, gitignorerade `.env.production.local` med produktions-URL och service-role-nyckel:

```powershell
node --env-file=.env.production.local scripts/admin.mjs set-code adrian
node --env-file=.env.production.local scripts/admin.mjs set-code dave
node --env-file=.env.production.local scripts/admin.mjs set-code elias
```

`npm run admin` använder fortfarande den lokala testdatabasen i `.env.local`. Ovanstående produktionskommandon väljer produktionsfilen uttryckligen.

Koder lagras i ett privat schema som individuellt saltade bcrypt-hashar med kostnad 12. Nya koder går först genom HMAC-SHA256 med bcrypt-saltet som nyckel, så att hela koden räknas även när den är längre än bcrypts inbyggda bytegräns. Äldre kodhashar fortsätter fungera utan att någon behöver byta kod. Servern tillåter högst fem inloggningsförsök per identitet och 30 per hashad nätverksadress under 15 minuter, även över flera funktionsinstanser. Identitetsgränsen fungerar även när proxyn delar eller maskerar klientadresser. `RATE_LIMIT_PEPPER` måste vara minst 32 tecken och sättas endast på servern.

Sessionstoken har 256 bitars slump och endast SHA-256-hashen lagras i databasen. Sessioner gäller 30 dagar och förnyas till 30 dagar vid aktiv serverkontroll, som sker vid återbesök, fönsterfokus och var femte aktiv minut. Absolut maxlivslängd är 90 dagar; därefter krävs kod igen. Varje skrivning låser och verifierar både session och aktiverad identitet. Utloggning och återkallelse gäller därför omedelbart även för redan öppna flikar.

Klienten förvarar bearer-token i localStorage för att fungera mellan besök från GitHub Pages till Supabase. Behandla enheten som inloggad; skydda mot XSS och undvik tredjepartsskript. Inga koder sparas i webbläsarlagringen. Utloggning kvitteras av servern innan token rensas; nätverksfel visas så man inte felaktigt tror att en session återkallats.

Alla publika tabeller har RLS och endast SELECT-grants till anon/authenticated. Privata credentials, sessioner, rate limits, importlogg, idempotenskvitton och auditlogg har RLS utan publika policies och ligger utanför exponerade scheman. Endast service_role kan anropa skrivrutinerna. Edge-funktionen har `verify_jwt=false` eftersom den verifierar egna, återkalleliga sessioner för varje skrivning. En publishable key utgör aldrig redigerarbehörighet. Origins kontrolleras på servern; CORS används dessutom för webbläsare. Lokal Supabase/Kong kan lägga på wildcard CORS även på nekade svar; serverns originspärr returnerar ändå 403 utan att utföra operationen.

## Google Sheets-import

Originalarket har lästs via autentiserad Drive/Sheets-anslutning. Källkopian `data/source-google-sheets.json` innehåller oförändrade värden och ursprungliga radpositioner, avlästa 2026-10-27. Verifierade rubriker: Speldatum, Spelare 1, Spelare 2, Set 1 och Set 2. Källans äldre kolumnnamn `Set 1`/`Set 2` behålls vid import men värdena betyder individuella matchvinster, inte set. Det fanns 7 giltiga raster och 593 tomma registreringsrader; ingen ogiltig ifylld match. Kontrollposten Dave–Elias 2–2, 2026-10-22 finns på källrad 402.

```sh
# Enbart validera källan; ingen databas eller tidigare importkontroll:
npm run import -- --file data/source-google-sheets.json --offline
# Förhandsgranska mot ansluten Supabase:
npm run import -- --file data/source-google-sheets.json
# Applicera uttryckligen och gör efterkontroll:
npm run import -- --file data/source-google-sheets.json --apply --report data/import-report.json
```

Den första lokala importen gav sju raster: Elias 9 poäng / 5 raster, Dave 5 / 4, Adrian 4 / 5. Tre oavgjorda. Upprepad import identifierade sju redan importerade raster och skapade inga dubbletter.

Uppdatering 2026-10-27: en ny hämtning från originalarket innehöll åtta raster. Alla åtta importerades till produktionsprojektet och den nya rasten lades till i den lokala databasen. Efterkontroll: åtta redan importerade rader, inga ogiltiga eller ändrade rader. Aktuell tabell: Elias 9 poäng / 5 raster, Dave 8 / 5, Adrian 4 / 6. Den versionshanterade källkopian ovan behåller de ursprungliga sju rasterna som fast underlag för isolerade CI/E2E-tester.

Direktläsning stöds med OAuth-token i `GOOGLE_ACCESS_TOKEN`, med scope `https://www.googleapis.com/auth/spreadsheets.readonly` och läsbehörighet till arket:

```sh
npm run import -- --spreadsheet 1dgEoemh0SxNO0kj02Jv7hAOZS_j5RDz-NcCVunTav8U --sheet Data
# Lägg till --apply först efter granskning.
```

Alternativ: exportera den oförändrade Data-fliken som CSV eller arbetsboken som XLSX:

```sh
npm run import -- --file /sökväg/källa.xlsx --sheet Data --source google:1dgEoemh0SxNO0kj02Jv7hAOZS_j5RDz-NcCVunTav8U:240101002
```

Använd samma `--source` för samma källflik vid varje körning; CSV måste behålla rubrikrad och tomma radpositioner. `row:N` är det stabila källrad-ID:t. Sortera eller flytta därför inte källrader efter första importen. Ändrade importerade rader flaggas och appliceringen stoppas för granskning. En borttagen importerad rast återuppstår inte vid återimport. Två identiska raster på olika källrader bevaras. Ingen deduplicering sker på datum/resultat. Ändrade rubriker kräver en verifierad JSON-mappning med `--mapping fil.json` (nycklar date/player1/player2/score1/score2). Rapporten listar varje tom, ogiltig, redan importerad eller ändrad källrad; applicering loggas privat i databasen och efterrapporten innehåller tabell och rastantal.

Efter importen läser appen enbart Supabase. Inga fortsatta Sheets-uppdateringar krävs.

## Statistik och dataintegritet

En `BreakSession`/`BreakInput` är en registrerad rast mellan två spelare. `score1` och `score2` är individuella matchvinster: 4–1 betyder en rast och fem matcher. Appen lagrar varken set eller ordningen på matcherna inom rasten. Befintliga registreringar tolkas på samma sätt, utan att delas upp.

`src/lib/statistics.ts` håller isär antal raster, rastvinster/oavgjorda/förluster och individuella matchvinster/förluster. P/R = (3 × rastvinster + oavgjorda raster) / raster. Rastvinstprocent använder raster som nämnare; matchvinstprocent använder vunna / spelade individuella matcher. Matchskillnad är vunna minus förlorade matcher. Matchskillnad per rast och matcher per rast använder antal raster som nämnare. Ligans totala matchantal summerar score1 + score2 en gång per rast.

Officiell placering använder totalpoäng, total matchskillnad, vunna matcher och sedan delad plats. P/R påverkar inte placeringen. Noll underlag ger null/”–”. Perioddiagram visar periodens P/R eller valt matchmått med underlag, med luckor utan raster. Rastaktivitet kan växlas till individuella matcher. Ligapoäng summeras vid varje datums slut med historisk ingångsnivå vid filtrering. Datum är SQL date, svensk dag bestäms med Europe/Stockholm och veckor börjar måndag. Inga sviter eller antagen ordning inom dagen/rasten beräknas.

Prestationsrekord kräver minst fem raster per spelare och kalendermånad, även matchvinstprocent och matchskillnad per rast. Förbättring kräver fem i båda angränsande månaderna. Datumfilter begränsar underlaget även i delvis valda månader. Volymrekord och rekord under en enskild rast har ingen femrastersgräns. Profiler visar raster och matcher var för sig och jämför P/R under de senaste 30 kalenderdagarna med föregående 30 inom aktivt filter.

Migration `202610270005_break_domain.sql` lägger till `break_snapshot()`, som returnerar ett komplett JSON-värde med `breaks` och verifierat `count` från en databassnapshot. Den fysiska tabellen `public.matches`, gamla `league_snapshot()`, skrivrutiner och importloggens fältnamn behålls för kompatibilitet. Inga resultat, ID:n, datum, källreferenser, auditloggar, kodhashar eller sessioner skrivs om. Samma RLS och grants gäller. Edge tar emot `break` och stöder fortsatt äldre klienters `match`. Importens domänobjekt/rapporter använder `break`; adaptern skickar det gamla RPC-formatet så tidigare importer och idempotenskvitton fortsätter fungera. Historiken visar 25 raster per sida; cache uppdateras efter skrivning och vid fönsterfokus.

Vid uppgradering: kör `supabase db push --linked`, publicera Edge-funktionen och därefter frontend. `supabase migration up --local` gäller lokalt. Kör aldrig databasreset vid uppgradering. Den äldre frontend fungerar även med den nya backendversionen.

Skapande använder ett beständigt idempotenskvitto även efter borttagning. Klienten behåller försökets ID vid nätverksfel och spärrar under pågående sparande. Redigering/borttagning använder `updated_at` som versionskontroll, så andras ändringar inte skrivs över utan varning. Raständring och auditlogg ligger i samma transaktion.

## Tester och visuell granskning

```sh
npm run typecheck
npm run lint
npm test
npm run test:admin
npm run test:db
npm run test:prepare
npm run test:security
npx playwright install chromium
npm run test:e2e
npm run build
node --env-file=.env.local --env-file=.env.test.local scripts/check-build.mjs
```

DB-tester kör verkliga SQL-behörigheter, constraints, sessionsflöden och import i en transaktion som rullas tillbaka. HTTP-tester anropar verklig lokal PostgREST och Edge Function. `test:prepare` genererar nya slumpade koder i `.env.test.local` endast för den lokala testligan, återkallar dess gamla sessioner och nollställer lokala försöksräknare. Använd `admin -- bootstrap` för produktionsligan. Testerna vägrar andra backendadresser än 127.0.0.1:55431 och DB-port 55432.

E2E kräver de sju importerade originalrasterna lokalt och en startad Edge Function. Skapa/ändra/radera-testet tar bort sin tillfälliga testrast. Browserkontroller körs i 375, 390, 768 och 1440 px, med svensk tidszon, interaktiva diagram och fungerande kodinloggning. Skärmbilder finns i `artifacts/screenshots/`, rapport i `playwright-report/`.

## Produktionsdrift

1. Anslut ett eget Supabase-projekt. Kör `supabase login`, sätt `SUPABASE_PROJECT_REF` och `SUPABASE_DB_PASSWORD` i den lokala miljön, och kör `npm run backend:deploy`. Alternativt använd workflow ”Supabase deployment” med GitHub-secrets `SUPABASE_ACCESS_TOKEN` och `SUPABASE_DB_PASSWORD`, repository variable `SUPABASE_PROJECT_REF`. Endast detta projekts migrationer och Edge Function distribueras; inga externa resurser raderas.
2. Sätt Edge-secrets `ALLOWED_ORIGINS=https://DITT-NAMN.github.io` (origin utan repository-sökväg) och en slumpad `RATE_LIMIT_PEPPER` med minst 32 tecken, exempelvis med `supabase secrets set --env-file /privat/sökväg/edge.env --project-ref PROJEKTREF`. Service-role och URL tillhandahålls av Supabase på servern. Lägg aldrig service-role i `VITE_`.
3. Sätt produktions-`SUPABASE_URL` och `SUPABASE_SERVICE_ROLE_KEY` i lokal ignorerad miljö. Kör `admin -- bootstrap`, förhandsgranska/importera originalrasterna och spara koderna privat. Kontrollera rapporten och att publika REST-skrivningar nekas.
4. I GitHub repository variables: sätt `VITE_SUPABASE_URL` och `VITE_SUPABASE_PUBLISHABLE_KEY` till produktionsvärden. I Settings → Pages välj GitHub Actions. Workflow ”GitHub Pages” bygger, testar och publicerar med repositoryns korrekta Vite base-sökväg och HashRouter. Automatisk publicering sker efter lyckat ”Quality”; utan backendvariabler hoppas deployment över. Ingen trasig tom frontend publiceras av misstag.

”Quality” installerar beroenden, kör typkontroll/lint/enhetstester, startar en isolerad Supabase, kör databas-/HTTP-/E2E-tester, bygger och söker efter serverhemligheter i bygget. PostgreSQL-migrationer och Edge-funktioner ligger under `supabase/`. Pages bygger enbart statiska filer från `dist/`. GitHub Pages för ett privat repository kräver en GitHub-plan som stöder det; annars kan ägaren välja offentlig repositorysynlighet.

CI använder Supabase CLI 2.122.0, autentiserad GHCR-hämtning och cache för Docker-avbilder. Tillfälliga registry-/nätverksfel återförsöks via andra registry-speglar. Databas- och migrationsfel stoppar fortfarande körningen; inga integrationskontroller hoppas över. Cachen innehåller avbilder, inte databasvolymer eller runtime-miljöfiler.

## Vanliga fel

- **Datakällan är inte ansluten:** kontrollera båda publika `VITE_`-värdena och starta om Vite. I Pages krävs ett nytt bygge efter variabeländring.
- **Servern är inte färdigkonfigurerad / 503:** ange ALLOWED_ORIGINS och RATE_LIMIT_PEPPER på Edge-servern.
- **401 före kodkontroll:** kontrollera att editor har `verify_jwt=false` och att rätt publishable key används. Egna sessionskontroller får aldrig tas bort.
- **403 origin_denied:** origin innehåller protokoll och domän/port men ingen sökväg eller avslutande `/`.
- **För många försök:** vänta 15 minuter. Det finns ingen klientbaserad genväg runt servergränsen.
- **Rasten har ändrats:** välj ”Hämta aktuell version” i redigeringsdialogen och granska ändringen innan du sparar.
- **Lokal CLI start misslyckas i Storage/GoTrue:** de tjänsterna används inte av Rastligans egna sessionsflöde. Använd exkluderingslistan ovan; annan lokal Supabase behöver inte stoppas.
- **Import visar source_changed:** granska raden mot ursprungsrapporten. Skriptet skriver inte över tidigare importerade resultat automatiskt.

Arkitekturen följer Supabases dokumentation om [egna autentiseringskontroller för Edge Functions](https://supabase.com/docs/guides/functions/auth), [skydd av API-ytan](https://supabase.com/docs/guides/api/securing-your-api) och Vites [GitHub Pages-konfiguration](https://vite.dev/guide/static-deploy#github-pages).
