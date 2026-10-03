# Docker Local Paleidimas

## Ko reikia

- `Docker Desktop`

## Kaip paleisti

Atsidarykite terminala projekto sakniniame kataloge:

```powershell
cd C:\Users\manta\Desktop\JobSeeker\JobSeeker
docker compose -f docker/docker-compose.yml up --build
```

Programa bus pasiekiama adresu:

- `http://localhost:3000`

## Paleidimas fone

```powershell
docker compose -f docker/docker-compose.yml up --build -d
```

## Kaip sustabdyti

```powershell
docker compose -f docker/docker-compose.yml down
```

## Kaip pamatyti logus

```powershell
docker compose -f docker/docker-compose.yml logs -f
```

## Kaip veikia SQLite failas

Compose faile naudojamas susietas katalogas:

- `../backend/data:/app/backend/data`

Tai reiskia:

- duomenu baze lieka jusu kompiuteryje kataloge `backend/data`
- backend konteineris naudoja ta pati SQLite faila
- jei paleisite scraperi host kompiuteryje, jis rasys i ta pacia duomenu baze

## Aplinkos kintamieji

Pagal nutylejima konteineris naudoja:

- `PORT=3000`
- `JWT_SECRET=local-dev-secret`

Jei norite naudoti kita `JWT_SECRET`, galite ji perduoti pries paleidima:

```powershell
$env:JWT_SECRET="mano-slaptas-raktas"
docker compose -f docker/docker-compose.yml up --build
```
