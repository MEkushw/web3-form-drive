# Web3 Form → Google Drive (Vercel-ready, no backend to host)

Single static HTML page. Submissions are pushed to Google Drive through a
Google **Apps Script** web app — Google hosts that bridge for you, so you run
zero servers and the page deploys anywhere (Vercel, GitHub Pages, Netlify…).

## Files
- `index.html` — the form page (deploy this to Vercel)
- `apps-script.gs` — the Google bridge that writes to Drive (paste into Google)

## 1) Deploy the form to Vercel
1. Push this folder to a Git repo (or import via Vercel CLI / dashboard).
2. Vercel → New Project → import repo. It detects a statics HTML site → deploys automatically.
   - No framework, no build step. Output: your public URL.

## 2) Create the Drive bridge (one time, ~3 min)
1. Go to <https://script.google.com> → **New project**.
2. Delete the default `function myFunction` code. Paste **all** of `apps-script.gs`. Save (Ctrl+S).
3. Run `setupFolder` once from the toolbar → authorize → it logs a `Folder ID` (creates a `Web3 Form` folder in Drive).
4. **Deploy** → **New deployment** → type **Web app**:
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**
   - Click **Deploy** (authorize again if asked). Copy the **Web app URL** (ends in `/exec`).

> First submit creates a `Web3 Form Log` spreadsheet automatically. Optional:
> open that spreadsheet once and authorize if Google asks. You can run
> `getLogSheet_()` from the editor to pre-create it.

## 3) Wire them together
1. Open `index.html`.
2. Replace:
   - `APPS_SCRIPT_URL = "REPLACE_..."` → your Web app URL
   - `DRIVE_FOLDER_ID = "REPLACE_..."` → the Folder ID from step 2.3
3. Re-deploy to Vercel. Done.

## How it works
- With `+ New`, `Back`, `Next` you add/move between entries before one Submit.
- Submit sends every non-empty entry as JSON (files as base64) to the Apps Script.
- Script, per entry: creates a Drive folder (`Name_yyyyMMdd_HHmmss`) with the shade file, the picture, and a `description.txt`.
- Script also appends a row to a **Google Sheet** (`Web3 Form Log`) — Timestamp, Name, Description, Shade URL, Picture URL.
- Response (Drive folder + Sheet URLs) prints to browser console.

## Security & limits
- Anyone with your Web app URL can submit. Protect by changing access to *Anyone* only when needed; it writes only to your Drive.
- Google Apps Script caps a POST at **~50MB total**. Keep each file under ~40MB (the page enforces 40MB per file).
- `mode: cors` + `Content-Type: text/plain` avoids a preflight; Apps Script handles it fine.