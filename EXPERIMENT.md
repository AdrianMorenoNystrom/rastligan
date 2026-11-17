# Lokalt test: månadsligor och glastema

Arbetsgren: `experiment/monthly-glass`. Detta test är inte publicerat till GitHub Pages eller produktions-Supabase.

Öppna http://127.0.0.1:5173/ och välj **Månadsliga**. Den senast spelade månaden visas först om den aktuella månaden saknar raster. Lokaldata innehåller oktober 2026; november kan väljas för att prova en tom, pågående månad.

- Varje kalendermånad har en egen tabell med befintliga 3/1/0-poäng och samma utslagsregler som totaltabellen. Speldatum avgör månaden.
- Avslutade månader visar månadsvinnare. Fullständigt lika resultat ger delad vinst. Pågående och kommande månader får ingen utsedd vinnare.
- Arkivet öppnar historiska tabeller i en dialog som växer fram från det tryckta kortet. Bakgrundens månadsval och scrollposition bevaras. Arkivdialogens månad finns i adressen som `arkiv=ÅÅÅÅ-MM` och bevaras vid omladdning. Spelarlänkar från en månadstabell öppnar statistik för exakt den kalendermånaden.
- Tabeller och vinnare beräknas från befintliga raster. Ändringar av datum eller resultat slår igenom direkt. Ingen databasändring eller lagrad kopia av månadsvinnare behövs.

## Utseende

Mörk bakgrund, mörka glaspaneler, systemtypsnitt, rundade kort, mjuk grön accent och en flytande mobilnavigation. Spelarfärgerna är ljusare för att vara tydliga mot mörka diagram. Färg- och materialanpassningen omfattar även formulär, dialoger, felmeddelanden, statistik och diagram. Även navigationens WebGL-scen och webbläsarens inbyggda datumkontroller använder det mörka temat.

Navigationens dekorativa material använder [ybouane/liquidglass](https://github.com/ybouane/liquidglass), npm-version 1.0.3 (MIT). Biblioteket läses in separat och får en liten, isolerad scen med en färggradient; tabeller, formulär och inloggningsuppgifter ingår inte i scenen. Enbart den synliga navigationen får en WebGL-instans. Den städas bort när visningsläget ändras eller komponenten tas bort.

CSS-materialet fungerar utan WebGL. Minskad rörelse stänger av WebGL-effekten. Minskad transparens ger solida ytor. Bibliotekets upstream-paket anropar `patch-package` i postinstall utan att deklarera det som runtime-beroende; projektet har därför det som utvecklingsberoende, så vanlig installation och CI-byggen fungerar.

## Kontroller

Automatiska tester täcker kalendermånader, årsskifte, skottår, månadsvinnare, delad placering och rättade resultat. E2E-tester kontrollerar månadsval, arkiv, tom månad, månadsfiltrerad profil, omladdning och återgång till totaltabell. Befintliga registrerings- och statistikflöden testas på 375, 390, 768 och 1440 px. Materialets CSS-fallback har även provats utan WebGL och med minskad rörelse.

Det här testet byter inte poängsystem, autentisering, import eller produktionsdata.

Verifierat: 89 enhetstester, 24 E2E-tester, lint, typecheck och produktionsbygge. Arkivtesterna omfattar Escape, bakgrundsklick, delbar adress, omladdning, bibehållen scroll, återställt fokus och minskad rörelse. Även scroll efter stängda redigerings- och borttagningsdialoger kontrolleras. Lokaldata efter testerna: åtta raster, 33 individuella matcher.

Förhandsbilder: [månadsliga på desktop](artifacts/screenshots/monthly-glass-desktop.png), [månadsliga på mobil](artifacts/screenshots/monthly-glass-mobile.png), [registrering på mobil](artifacts/screenshots/monthly-glass-register.png). De tidigare granskningsbilderna visar den publicerade versionen och har behållits för jämförelse.

Darkmode-kontrollen omfattade även [statistik på desktop](artifacts/screenshots/monthly-glass-statistics.png) och navigation utan WebGL-effekt. Spelarkoder och autentiseringsregler ändrades inte.

## Rörelse

- Knappar trycks ned lätt och fjädrar tillbaka. Arkivkort lyfts vid hover på enheter med mus.
- Navigation och ligaväljare har en glidande markering. Vybyten, statistikvärden och sparbekräftelser får korta övergångar.
- Arkivdialogen animeras från kortets verkliga skärmposition och stängs tillbaka till kortet. Dialogen innehåller månadens tabell, vinnare och raster. Scrollen ligger kvar och fokus återgår till kortet.
- Vanliga dialoger får också mjuk öppning och stängning. Native `dialog` behåller fokusfälla, Escape och bakgrundens inaktiva tillstånd. CSS kopplar scrollåset till faktiska öppna dialoger, även vid nästlade dialoger.
- Animationerna använder CSS och Web Animations API utan ett extra animationsbibliotek. Minskad rörelse stänger av förflyttningar, knappskalning och dialoganimationer.

Arkivdialogens slutläge: [desktop](artifacts/screenshots/monthly-glass-archive-desktop.png) och [mobil](artifacts/screenshots/monthly-glass-archive-mobile.png).

## Statistikens startsida

Öppna http://127.0.0.1:5173/#/statistik. Översikten visar antal matcher, raster, speldagar, matcher per rast och oavgjorda raster i vald period.

- Tre animerade ringar visar spelarnas vinstprocent. Varje ring har en egen skala från 0 till 100 procent. Välj spelare för att se vunna och spelade matcher, eller växla till raster för rastvinstprocent. Saknat underlag visas med streck.
- Spelarkorten visar placering, ligapoäng, P/R och vunna, oavgjorda och förlorade raster. Korten öppnar spelarprofilen med samma datumfilter.
- Duellpanelen kan växla mellan alla tre spelarpar. Den skiljer på individuella matchvinster och rastvinster och länkar till duellen inom samma period.
- Befintliga diagram för P/R, aktivitet och sammanlagda ligapoäng finns kvar, liksom speldagskalendern och flikarna Spelare, Dueller och Rekord. P/R-diagrammet har diskreta färgfält under linjerna. Luckor och verkliga mätvärden bevaras.
- Sammanfattningen kan visas medan diagramkoden laddas. Layouten anpassas för mobil och ringanimationerna följer inställningen för minskad rörelse.
- När översikten öppnas räknas siffrorna upp, ringarna ritas och resultatstaplarna fylls i en kort följd. Diagrammens kurvor ritas fram och kalenderns speldagar tonas in. Varje del börjar när den kommer in i bild och spelas en gång per besök, utan att upprepas vid scroll fram och tillbaka. Uppbyggnaden tar ungefär en sekund; filter- och spelarbyten uppdaterar siffrorna med en kortare övergång.
- Siffrorna behåller sin bredd under uppbyggnaden. Skärmläsare får slutvärdena direkt. Minskad rörelse visar alla värden och diagram utan animation. Avbrutna övergångar städas bort vid filterbyte eller när vyn lämnas.

Tester kontrollerar skilda nämnare för match- och rastvinstprocent, tomt urval, ärvda datumfilter, byte av duell och att diagrammets tooltip visar ett värde per spelare. Animationstesterna kontrollerar scrollstart, minskad rörelse, avbruten uppräkning och att skärmläsarens värde finns direkt. Mobil och desktop har även granskats visuellt: [desktop](artifacts/screenshots/statistics-home-desktop.png), [mobil](artifacts/screenshots/statistics-home-mobile.png).
