# JobSeeker Git Ir Procesų Taisyklės

## Siūlomos taisyklės

### 1. Viena užduotis, viena šaka, vienas šakos pavadinimo formatas

Kiekviena Jira užduotis turi būti įgyvendinama atskiroje šakoje.

Leidžiami šakų formatai:

- `feat/KAN-xxx-trumpas-aprasymas`
- `bug/KAN-xxx-trumpas-aprasymas`
- `dev/KAN-xxx-trumpas-aprasymas`

Pavyzdžiai, kurie jau naudojami šioje saugykloje:

- `feat/KAN-35-CV-Banko-scraperis`
- `bug/KAN-105-Add-listings-to-front-end`
- `feat/KAN-47-api-issaugotiems-darbo-skelbimams`

Priežastis:

- Taip pakeitimai aiškiai susiejami su viena backlog užduotimi.
- Taip lengviau atlikti kodo peržiūrą ir CI vykdymą, nes kiekviena šaka turi vieną aiškų tikslą.

### 2. Kiekvienas commit turi turėti užduoties numerį ir konkretų veiksmą

Commit žinutė visada turi prasidėti užduoties numeriu ir apibūdinti vieną konkretų pakeitimą.

Rekomenduojamas formatas:

- `KAN-xxx feat: add ...`
- `KAN-xxx fix: correct ...`
- `KAN-xxx test: add ...`
- `KAN-xxx chore: update ...`

Geri pavyzdžiai iš dabartinės istorijos:

- `KAN-24 add auth unit tests`
- `KAN-48 add unit tests for saved jobs module`
- `KAN-108 feat: add marker info cards to map`

Žinučių, kurių reikėtų vengti, pavyzdžiai:

- `API Integration (CRUD)`
- `feat: Added CV preview before save`

Priežastis:

- Užduoties numeriai leidžia lengviau susieti commitus su reikalavimais, klaidomis ir testais.
- Veiksmą apibūdinančios žinutės gerina atsekamumą ataskaitose ir derinant klaidas.

### 3. Tiesiogiai į `develop` ar `main` necommitinti

Visi kodo pakeitimai pirmiausia turi būti atliekami užduoties šakoje, o tada jungiami į `develop` per pull request.

Prieš atidarant arba atnaujinant PR:

- atsisiųsti naujausią `origin/develop`
- atsinaujinti savo šaką iš `develop`
- konfliktus išspręsti pačioje užduoties šakoje prieš jungimą

Priežastis:

- Saugyklos istorija rodo, kad lygiagrečiai dirba keli komandos nariai.
- Ankstesnis atsinaujinimas iš `develop` sumažina didelių konfliktų tikimybę vėliau, ypač bendruose failuose, tokiuose kaip `frontend/job-search.js`.

### 4. Šaka nėra paruošta jungimui, kol nepraeina build ir testai

Prieš jungiant į `develop`, autorius turi paleisti atitinkamus automatinius patikrinimus lokaliai ir CI aplinkoje.

Minimalus reikalavimas:

- backend testai backend pakeitimams
- scraper testai scraper pakeitimams
- rankinis smoke patikrinimas frontend pakeitimams, jei nėra automatinio UI testo

Sritys, kurios jau turi testus ir turi likti apsaugotos:

- auth maršrutai
- jobs maršrutai
- saved jobs maršrutai
- CV validacija ir maršrutai
- scraper parsavimas ir įrašymas į duomenų bazę

Priežastis:

- Komanda jau reguliariai rašo testus, todėl ši taisyklė tik formalizuoja esamą gerą praktiką.
- Taip sumažinama regresijų tikimybė, kai tą pačią dieną sujungiamos kelios šakos.

### 5. Naujas funkcionalumas arba klaidos taisymas turi būti lydimas testų

Jeigu šaka keičia arba prideda elgseną, joje turi būti bent vienas testų commit arba atnaujintas testų failas, nebent pakeitimas yra tik vizualinis.

Pavyzdžiai iš istorijos, kurie šios taisyklės laikosi gerai:

- `KAN-24 add auth unit tests`
- `KAN-48 add unit tests for saved jobs module`
- `KAN-101 feat: add unit tests for GET /api/jobs pagination`
- `KAN-72 feat: add unit tests for PUT and DELETE /api/cv/:id`

Priežastis:

- Tai gerina apsaugą nuo regresijų.
- Tai padeda įgyvendinti namų darbo reikalavimus, susijusius su integraciniu arba regresiniu testavimu.

## Rekomenduojamas merge kontrolinis sąrašas

Prieš jungiant šaką į `develop`, reikia patikrinti:

- šakos pavadinimas atitinka `feat/`, `bug/` arba `dev/` formatą su Jira numeriu
- commit žinutėse yra Jira numeris
- šaka atnaujinta pagal naujausią `develop`
- nėra netyčia įtrauktų sugeneruotų failų
- atitinkami testai praeina
- PR aprašyme nurodyta Jira užduotis ir paveiktas funkcionalumas

## Rekomenduojami Git įrankiai ir metodai

Naudingiausi papildymai šiai komandai:

- pull request kiekvienai užduoties šakai
- apsaugota `develop` šaka su privaloma peržiūra
- privalomi status checks prieš merge
- issue ir PR šablonai, kuriuose privaloma nurodyti Jira numerį, apimtį ir testavimo pastabas
- `.gitignore` peržiūra sugeneruotiems failams, pavyzdžiui duomenų bazėms, cache failams ir lokaliems artefaktams

## Tikėtina nauda

Jeigu komanda laikysis šių taisyklių, tikėtini tokie pagerėjimai:

- mažiau merge konfliktų bendruose frontend ir backend failuose
- geresnis atsekamumas nuo reikalavimo iki šakos, commito ir testo
- lengvesnis CI klaidų analizavimas, nes kiekviena šaka atitinka vieną užduotį
- lengvesnis ataskaitos rengimas, nes commitai ir šakos jau susieti su Jira numeriais
