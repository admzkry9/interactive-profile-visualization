# Wealth Atlas — 3D Data Explorer

A Vite + Three.js CSS3D visualization for the interview assignment. It starts with the supplied CSV as a local fallback and can load the live Google Sheet after Google OAuth authorization.

## 1. Requirements

- Node.js LTS
- A Google Cloud project with **Google Sheets API enabled**
- A Google OAuth 2.0 **Web application** client ID
- The signed-in Google account must have at least Viewer access to the spreadsheet

## 2. Configure Google credentials

The included `.env.local` is prefilled with the spreadsheet ID and OAuth client ID supplied for this project. If you replace either credential, update the values in `.env.local`:

```env
VITE_GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
VITE_GOOGLE_SPREADSHEET_ID=YOUR_SPREADSHEET_ID
VITE_GOOGLE_SHEET_RANGE=Data!A1:G201
```

The client ID is public frontend configuration; never put a client secret in this file. `.env.local` is excluded from Git by `.gitignore`.

In Google Cloud Console:

1. Enable **Google Sheets API**.
2. Configure Google Auth Platform / OAuth consent screen. During testing, add the Google account you will use as a test user.
3. Create an OAuth Client ID with application type **Web application**.
4. Under **Authorized JavaScript origins**, add `http://localhost:5173`.
5. Ensure the OAuth app permits the `openid`, `email`, `profile`, and `https://www.googleapis.com/auth/spreadsheets.readonly` scopes. The app requests the Sheets read-only scope when the user clicks Sign in with Google.
6. Share the spreadsheet with the Google account that will sign in. It needs Viewer or Editor access.

## 3. Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`). The page initially loads `public/data.csv`. Click **Sign in with Google** to authorize and replace the local data with values from the `Data` tab in the configured spreadsheet.

## 4. Assignment layouts

- Table: 20 columns × 10 rows
- Sphere: Fibonacci sphere distribution
- Double Helix: two intertwined strands
- Grid: 5 × 4 × 10

Net worth bands: red `< $100,000`; orange `$100,000–$200,000`; green `> $200,000`.

## 5. Production deployment

Set the same three environment variables in your hosting provider's project settings. Add the final HTTPS site origin to the OAuth client's **Authorized JavaScript origins**. Rebuild and deploy with `npm run build`.

For a public production app, review Google's OAuth verification requirements for the requested sensitive Sheets scope. The spreadsheet remains private; the signed-in user must have access to it.
