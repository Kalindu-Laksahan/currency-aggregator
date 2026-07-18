# ExchangeWatch LK 💱

> Live Sri Lanka currency exchange rates aggregated from 20 commercial banks — powered by Google Sheets, deployed free on GitHub Pages.

[![Deploy Status](https://img.shields.io/github/deployments/YOUR_USERNAME/YOUR_REPO/github-pages?label=GitHub%20Pages&style=flat-square)](https://YOUR_USERNAME.github.io/YOUR_REPO/)
[![Snapshot](https://img.shields.io/github/actions/workflow/status/YOUR_USERNAME/YOUR_REPO/daily-snapshot.yml?label=Daily%20Snapshot&style=flat-square)](https://github.com/YOUR_USERNAME/YOUR_REPO/actions)

---

## Features

- 🔴 **Live rates** — fetches directly from Google Sheets at page load
- 📊 **24 currencies** — USD, GBP, EUR, AED, AUD, BHD, CAD, CHF, CNY, DKK, HKD, JOD, JPY, KWD, NOK, NZD, OMR, QAR, RMB, SAR, SEK, SGD, TBH, ZAR
- 🏦 **20 banks** — all major Sri Lankan commercial banks
- 📈 **% vs Best** — instantly see how far each bank's rate is from the best available
- 📉 **30-day history chart** — auto-populated by GitHub Actions
- 📱 **Responsive** — works on mobile, tablet, desktop

---

## Deployment (GitHub Pages)

### Step 1 — Create a GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. Name it (e.g. `exchange-watch-lk`)
3. Set it to **Public**
4. **Do NOT** initialize with README (you already have one)
5. Click **Create repository**

### Step 2 — Push the code

Open a terminal in the project folder and run:

```bash
git init
git add .
git commit -m "feat: initial ExchangeWatch LK deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

> Replace `YOUR_USERNAME` and `YOUR_REPO` with your actual GitHub username and repo name.

### Step 3 — Enable GitHub Pages

1. Go to your repo on GitHub
2. Click **Settings** → **Pages** (left sidebar)
3. Under **Source**, select: **Deploy from a branch**
4. Branch: `main` | Folder: `/ (root)`
5. Click **Save**

Your site will be live at: `https://YOUR_USERNAME.github.io/YOUR_REPO/`
*(Takes ~2 minutes for first deploy)*

### Step 4 — Verify the Google Sheet is public

In Google Sheets: **Share** → **Anyone with the link** → **Viewer** → Done.

---

## Automated Snapshot Schedule (GitHub Actions)

The workflow at `.github/workflows/daily-snapshot.yml` runs **3× daily automatically** — no server, no cost, no involvement from you:

| Time (UTC) | Time (IST +5:30) | Action |
|---|---|---|
| **07:45 UTC** | 1:15 PM IST | Morning snapshot — appends to history |
| **13:45 UTC** | 7:15 PM IST | Afternoon snapshot — appends to history |
| **23:45 UTC** | 5:15 AM IST | Evening run — **consolidates** (keeps 1 record/day, max 30 days) |

### How the Consolidation Works

```
DAY TIMELINE:
  07:45 UTC → captures morning rates → history.json gets +1 entry
  13:45 UTC → captures afternoon rates → history.json gets +1 entry  
  23:45 UTC → captures evening rates
             + removes the 07:45 and 13:45 entries for TODAY
             → history.json: only 1 entry remains for today
             → sliced to last 30 days max
```

After the 23:45 run, `history.json` always holds exactly **one entry per day** for the last 30 days.

### How to Test the Workflow Manually

1. Go to your repo → **Actions** tab
2. Click **"Rate Snapshots (Morning / Afternoon / Evening)"**
3. Click **"Run workflow"** → choose `evening` from the dropdown
4. Click **Run workflow** (green button)
5. Watch the run complete in ~30 seconds
6. Check that `public/data/history.json` was updated

---

## Data Source

Rates are pulled from a publicly accessible Google Sheet via the **Google Visualization (GViz) JSON API** — no API key required.

Sheet: `https://docs.google.com/spreadsheets/d/1ZXvoy_yDJEFN5LA3mrCFzg7L2REZ3gY4X4mQIXJ-r1Q/`

---

## License

MIT — free to use, fork, and deploy.
