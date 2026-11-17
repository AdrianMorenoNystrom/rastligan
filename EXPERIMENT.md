# Lokalt test: månadsligor och glastema

Arbetsgren: `experiment/monthly-glass`. Detta test är inte publicerat till GitHub Pages eller produktions-Supabase.

Öppna http://127.0.0.1:5173/ och välj **Månadsliga**. Den senast spelade månaden visas först om den aktuella månaden saknar raster. Lokaldata innehåller oktober 2026; november kan väljas för att prova en tom, pågående månad.

- Varje kalendermånad har en egen tabell med befintliga 3/1/0-poäng och samma utslagsregler som totaltabellen. Speldatum avgör månaden.
- Avslutade månader visar månadsvinnare. Fullständigt lika resultat ger delad vinst. Pågående och kommande månader får ingen utsedd vinnare.
- Arkivet öppnar historiska tabeller. Vald månad finns i adressen och bevaras vid omladdning. Spelarlänkar från en månadstabell öppnar statistik för exakt den kalendermånaden.
- Tabeller och vinnare beräknas från befintliga raster. Ändringar av datum eller resultat slår igenom direkt. Ingen databasändring eller lagrad kopia av månadsvinnare behövs.

## Utseende

Ljus bakgrund, systemtypsnitt, rundade kort, tydligare spelarfärger och en flytande mobilnavigation. Färg- och materialanpassningen omfattar även formulär, dialoger, statistik och diagram.

Navigationens dekorativa material använder [ybouane/liquidglass](https://github.com/ybouane/liquidglass), npm-version 1.0.3 (MIT). Biblioteket läses in separat och får en liten, isolerad scen med en färggradient; tabeller, formulär och inloggningsuppgifter ingår inte i scenen. Enbart den synliga navigationen får en WebGL-instans. Den städas bort när visningsläget ändras eller komponenten tas bort.

CSS-materialet fungerar utan WebGL. Minskad rörelse stänger av WebGL-effekten. Minskad transparens ger solida ytor. Bibliotekets upstream-paket anropar `patch-package` i postinstall utan att deklarera det som runtime-beroende; projektet har därför det som utvecklingsberoende, så vanlig installation och CI-byggen fungerar.

## Kontroller

Automatiska tester täcker kalendermånader, årsskifte, skottår, månadsvinnare, delad placering och rättade resultat. E2E-tester kontrollerar månadsval, arkiv, tom månad, månadsfiltrerad profil, omladdning och återgång till totaltabell. Befintliga registrerings- och statistikflöden testas på 375, 390, 768 och 1440 px. Materialets CSS-fallback har även provats utan WebGL och med minskad rörelse.

Det här testet byter inte poängsystem, autentisering, import eller produktionsdata.

Verifierat: 82 enhetstester, 12 E2E-tester, lint, typecheck och produktionsbygge. Efter att registreringsvyn gjorts kompaktare kördes dess mobiltest igen. Lokaldata efter testerna: åtta raster, 33 individuella matcher.

Förhandsbilder: [månadsliga på desktop](artifacts/screenshots/monthly-glass-desktop.png), [månadsliga på mobil](artifacts/screenshots/monthly-glass-mobile.png), [registrering på mobil](artifacts/screenshots/monthly-glass-register.png). De tidigare granskningsbilderna visar den publicerade versionen och har behållits för jämförelse.
