/**
 * Google Apps Script — saves Web3 Form submissions to Google Drive.
 *
 * SETUP (one time, ~3 min, no code hosting on your side):
 *   1. Go to https://script.google.com and create a new project.
 *   2. Paste this whole file in. Save.
 *   3. Run function `setupFolder` once (from the editor toolbar) and authorize.
 *      It creates a "Web3 Form" folder in your Drive and prints its ID.
 *   4. Deploy: Deploy > New deployment > type "Web app".
 *      - Execute as: Me
 *      - Who has access: Anyone
 *   5. Copy the Web app URL. Paste into index.html `APPS_SCRIPT_URL`
 *      and optionally `DRIVE_FOLDER_ID`.
 *
 * The form POSTs JSON:
 *   {
 *     "folderId": "optional-folder-id",
 *     "entries": [{
 *       "name": "...",
 *       "desc": "...",
 *       "files": {
 *         "shade":   { "name": "x.pdf",  "type": "application/pdf", "data": "<base64>" },
 *         "picture": { "name": "y.png",  "type": "image/png",        "data": "<base64>" }
 *       }
 *     }]
 *   }
 * Response: JSON { ok: true, folderUrl, items: [{ name, url, files: {shade, picture} }] }
 */

const DEFAULT_FOLDER = "Web3 Form";
const DEFAULT_SHEET  = "Web3 Form Log";

function setupFolder() {
  const folders = DriveApp.getFoldersByName(DEFAULT_FOLDER);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(DEFAULT_FOLDER);
  Logger.log("Folder ID: " + folder.getId());
  Logger.log("Folder URL: " + folder.getUrl());
  return folder.getId();
}

function getLogSheet_() {
  const byName = SpreadsheetApp.getActiveSpreadsheet();
  if (byName) return byName;
  const files = DriveApp.getFilesByName(DEFAULT_SHEET);
  return files.hasNext()
    ? SpreadsheetApp.open(files.next())
    : SpreadsheetApp.create(DEFAULT_SHEET);
}

function ensureHeader_(sheet) {
  const vals = sheet.getRange(1, 1, 1, 5).getValues()[0];
  if (vals.join("").length) return;
  sheet.getRange(1, 1, 1, 5)
    .setValues([["Timestamp", "Name", "Description", "Shade URL", "Picture URL"]])
    .setFontWeight("bold");
}

function doGet() {
  return ContentService.createTextOutput(
    "Web3 Form bridge is live. POST JSON to save to Drive."
  ).setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    if (!e || !e.postData) throw new Error("No POST data received.");
    const payload = JSON.parse(e.postData.contents);

    let folder = null;
    const folderId = (payload.folderId || "").toString().trim();
    if (folderId) {
      try { folder = DriveApp.getFolderById(folderId); }
      catch (err) { folder = null; }
    }
    if (!folder) {
      const folders = DriveApp.getFoldersByName(DEFAULT_FOLDER);
      folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(DEFAULT_FOLDER);
    }

    const items = [];
    for (const entry of payload.entries || []) {
      const name = (entry.name || "Untitled").toString().trim();
      const folderName = sanitize(name || "Untitled") + "_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
      const sub = folder.createFolder(folderName);
      if (entry.desc) sub.createFile("description.txt", String(entry.desc));

      const saved = {};
      for (const key of ["shade", "picture"]) {
        const f = (entry.files || {})[key];
        if (f && f.data) {
          const blob = Utilities.newBlob(
            Utilities.base64Decode(f.data),
            f.type || "",
            f.name || (key + ".bin")
          );
          saved[key] = sub.createFile(blob).getUrl();
        }
      }
      items.push({ name: sub.getName(), url: sub.getUrl(), files: saved });
    }

    const sheet = getLogSheet_();
    ensureHeader_(sheet);
    const rows = [];
    for (const item of items) {
      const name = item.name;
      const desc = entryDesc(item);
      rows.push([
        Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss"),
        name,
        desc,
        (item.files || {}).shade || "",
        (item.files || {}).picture || "",
      ]);
    }
    if (rows.length) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);

    const logUrl = SpreadsheetApp.open(getLogSheet_()).getUrl();
    return json({ ok: true, count: items.length, folderUrl: folder.getUrl(), logUrl, items });
  } catch (err) {
    return json({ ok: false, error: String(err) }, 500);
  }
}

function json(obj, code) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sanitize(s) {
  return s.replace(/[\\/:*?"<>|]/g, "_").slice(0, 60);
}

function entryDesc(item) {
  try {
    const sub = DriveApp.getFolderById(DriveApp.getFileByUrl(item.url).getId());
    const t = sub.getFilesByName("description.txt");
    if (t.hasNext()) return t.next().getBlob().getDataAsString();
  } catch (e) {}
  return "";
}
