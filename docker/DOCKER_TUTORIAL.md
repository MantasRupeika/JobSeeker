# Docker Tutorial

## 1. Open the project root

```powershell
cd C:\Users\user\Desktop\JobSeeker\JobSeeker
```

## 2. Build and start the app

```powershell
docker compose -f docker/docker-compose.yml up --build
```

## 3. Open the app in the browser

- `http://localhost:3000`

## 4. Run in the background

```powershell
docker compose -f docker/docker-compose.yml up --build -d
```

## 5. View logs

```powershell
docker compose -f docker/docker-compose.yml logs -f
```

## 6. Stop the app

```powershell
docker compose -f docker/docker-compose.yml down
```

## 7. Important note about SQLite

The Docker setup uses the local `backend/data` folder as a mounted volume.

This means:

- the SQLite database stays on your computer
- the backend container uses the same database file
- the scraper can still write to that same database file

## 8. Optional JWT secret

If you want to start Docker with a custom JWT secret:

```powershell
$env:JWT_SECRET="mano-slaptas-raktas"
docker compose -f docker/docker-compose.yml up --build
```
