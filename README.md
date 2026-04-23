# NWISD Stadium Survey App

A mobile-first field survey and commissioning app for stadium AV work, with Supabase auth, project sync, storage-backed photo uploads, PDF export, and sign-off.

## 1. Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Add your real Supabase values to `.env.local`.

## 2. Supabase setup

1. Create a Supabase project.
2. In **Authentication**, enable **Email** sign-in.
3. In **Project Settings → API Keys**, copy:
   - Project URL
   - Publishable key
4. Create a `.env.local` file with:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
VITE_SUPABASE_BUCKET=survey-photos
```

5. Open **SQL Editor** in Supabase and run the SQL block shown in the app's **Cloud / Sync** tab.

## 3. Vercel deployment

1. Push this project to GitHub.
2. In Vercel, click **Add New Project** and import the repo.
3. In **Environment Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_BUCKET`
4. Deploy.

Vercel's Vite docs note that environment variables exposed to the client must be prefixed with `VITE_`. Supabase's current docs recommend using the newer publishable key for client-side apps. See the citations in the handoff message.

## 4. First-use workflow

1. Open the deployed link.
2. Go to **Cloud / Sync**.
3. Enter your email and request a magic link.
4. Open the email and sign in.
5. Create a cloud record before uploading field photos if you want them stored in Supabase Storage.
6. Start the survey, save to cloud as you go, and export PDF from the **Report** tab.

## 5. Notes

- Local browser storage is still used as a fallback.
- If no cloud project exists yet, photo uploads are stored locally as base64 previews.
- Once a cloud project exists, photo uploads go to Supabase Storage.
- Signed image URLs expire; the app currently creates them at upload time. A future enhancement would refresh signed URLs automatically.
