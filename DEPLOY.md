# Deployment Guide — Living Study Guide

This project is a zero-build, client-side web application built with vanilla HTML, CSS, and modern ES modules. It runs in any modern browser without servers, databases, or build pipelines.

---

## 1. Quick Deploy via Replit

### Replit One-Click Import URL
Use this URL to import the repository directly into Replit:
👉 **[https://replit.com/github.com/DAOVAST-Developers/living-study-guide](https://replit.com/github.com/DAOVAST-Developers/living-study-guide)**

### Steps to Run & Publish on Replit:
1. Open the import URL above in your browser. Replit will clone the repository into a new Repl.
2. Verify that `.replit` is present in the root folder with:
   ```toml
   run = "python -m http.server 8000"
   entrypoint = "index.html"

   [deployment]
   deploymentTarget = "static"
   publicDir = "."
   ```
3. Click the green **Run** button at the top to start the local preview on port 8000.
4. To publish to the web, click **Deploy** / **Publish** in the top right corner:
   - Select **Static** deployment (pre-configured in `.replit`).
   - Click **Deploy Repl**.
   - Your permanent public HTTPS URL will be generated instantly.

---

## 2. Fallback: Netlify Drop (Instant Drag & Drop)

If you do not want to use Replit or GitHub:
1. Navigate to **[https://app.netlify.com/drop](https://app.netlify.com/drop)**.
2. Drag and drop this entire `living-study-guide` project folder into the upload target.
3. Netlify will deploy it in seconds with a free SSL-secured URL. No build step or command configuration required.

---

## 3. Local Development & Self-Hosting

You can host this project with any static file server:

### Using Python:
```bash
python -m http.server 8000
```
Open [http://localhost:8000](http://localhost:8000) in your browser.

### Using Node / npx:
```bash
npx serve -l 8000 .
```

---

## 4. Manual Git Commands (If Needed)

If pushing to a new GitHub repository manually:
```bash
git init
git add .
git commit -m "Initial release: Living Study Guide"
git branch -M main
git remote add origin https://github.com/DAOVAST-Developers/living-study-guide.git
git push -u origin main
```

---

## 5. Verification Checks to Run on the Public Link

After deploying to your public URL, perform these three validation checks:

1. **Persistence Test**:
   - Unlock the vault or load demo data.
   - Approve at least 2 cards so they appear in the Library.
   - Close the browser tab or entire window, reopen your public URL, and enter your passphrase.
   - **Check**: Verify your approved Library cards and settings are still intact from IndexedDB.

2. **Private Window / Lock Screen Test**:
   - Open your deployed URL in an Incognito / Private Browsing window.
   - **Check**: Verify the Privacy Lock Screen appears immediately, blocking access until a passphrase is set or entered.

3. **Backup Download Test**:
   - Unlock the app, click **⚙️ Settings**, and click **⬇️ Download Backup (JSON)**.
   - **Check**: Verify a file named `living-study-guide-backup-YYYY-MM-DD.json` downloads successfully to your computer containing your sources and items.
