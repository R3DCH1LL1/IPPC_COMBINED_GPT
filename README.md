# IPPC Combined Study Suite

This is the combined Github/Vercel-ready version of the IPPC Study Notes app and IPPC Mock Test app.

## What is included

- A new landing page where users choose either **Notes** or **Mock Test**.
- The full study notes page at `/notes/index.html`.
- The full mock test/question bank React app under `#mock`.
- Mobile-friendly landing cards and navigation.

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL shown by Vite.

## Build locally

```bash
npm run build
npm run preview
```

## Deploy on Vercel

1. Upload/push this folder to GitHub.
2. Import the GitHub repo into Vercel.
3. Framework preset: **Vite**.
4. Build command: `npm run build`.
5. Output directory: `dist`.

## Main paths

- `/` = Study Suite menu
- `/#notes` = Notes page embedded in the suite
- `/#mock` = Mock Test app
- `/notes/index.html` = Notes full page
