# ArchPoint Visitors

Visitor management for the Arch Point office, Jaipur (check-in, live board, host replies, appointments, meeting day, contacts, reports, import and export).

connect@archpointgp.com · @archpoint_architecture · archpoint.in

## What is in this folder
- `index.html` — the whole app (HTML, CSS and JavaScript in one file, logo embedded)
- `shim.js` — a local stand-in for the Claude artifact database and sign-in, so the app runs outside Claude
- `.github/workflows/pages.yml` — publishes the folder to GitHub Pages on every push to `main`

## Important: this is a demo copy
Outside Claude, data is saved in the browser's localStorage. It is not shared between computers or people, there is no real login, and clearing the browser data erases it. Use it to show and test the screens. For real office use, either keep using the Claude artifact, or move to a real backend (Supabase, then Hostinger KVM 2) with proper email and password sign-in.

## Run in VS Code
1. Install VS Code and the **Live Server** extension (VS Code suggests it).
2. File > Open Folder > this folder.
3. Right-click `index.html` > **Open with Live Server**.
4. In the app: Settings > Load ArchPoint starter data, then Add sample visitors.

## Put it on GitHub
```bash
git init
git add .
git commit -m "ArchPoint Visitors demo"
git branch -M main
git remote add origin https://github.com/<your-user>/archpoint-visitors.git
git push -u origin main
```
Then on GitHub: Settings > Pages > Source: **GitHub Actions**. The site appears at `https://<your-user>.github.io/archpoint-visitors/`.

Free GitHub Pages sites are public, even if the repository is private. The demo holds no real data, so that is fine. Never commit real visitor data.

## Connect VS Code to GitHub
Sign in with the Accounts icon (bottom left), then use the Source Control tab: write a message, Commit, Sync Changes.

## Later: real backend
The app only talks to `claude.use("db")`, `claude.use("user")` and `claude.use("downloads")`. To move to Supabase, replace the shim with an adapter exposing the same calls, backed by Postgres tables with row-level security.
