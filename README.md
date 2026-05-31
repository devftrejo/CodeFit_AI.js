# Project - CodeFit_AI.js

## Purpose

To serve as ${DarkMode} Devs company online AI bootcamp, as such, it will always be under development.

Only ${DarkMode} Devs company developers are authorized to use this code for the sole purpose of maintaining and updating this project for the benefit of the company - ${DarkMode} Devs.

## Built With

### Frontend

<div align="center">
   <div id="badges">
       <a href="">
         <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML 5 Badge"/>
       </a>
       <a href="">
         <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS 3 Badge"/>
       </a>
       <a href="">
         <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript Badge"/>
       </a>
   </div>
</div>

### Backend

<div align="center">
   <div id="badges">
       <a href="">
         <img src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white" alt="Node JS Badge"/>
       </a>
       <a href="">
         <img src="https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" alt="Firebase Badge"/>
       </a>
   </div>
</div>

#### NOTE: This can change at any time during the project's growth and development.

## Repository Layout

This repo is an **npm workspace** with two packages:

```
client/      Vite MPA — vanilla JS ES modules, CodeMirror 6 + marked + Font Awesome (all bundled from npm)
functions/   Cloud Functions for Firebase (v2, ESM). The chat handler: auth, OpenAI streaming, and Firestore persistence.
```

Most dependencies hoist to a single root `node_modules/`, so you install once at the repo root. (A few `functions/` deps stay local under `functions/node_modules/` because of npm version-resolution rules — that's normal and works both locally and on Firebase deploys.)

Firebase configuration lives at the repo root: `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`.

The client ships five pages:

- `/` — landing
- `/app.html` — the chat + code-sandbox app (gated on sign-in)
- `/about.html` — about
- `/contact.html` — contact
- `/sign-in.html` — sign-in / create-account (Email/Password + Google)

All five share a top-bar nav. The chat app additionally has an off-canvas navbar for the Conversations, Curriculum, and AI Roles menus.

## Getting Started

### Prerequisites

Make sure a current Node.js LTS and npm are available:

```sh
node -v
npm -v
```

If either is missing or out of date, install or update Node from [nodejs.org](https://nodejs.org).

### Initial Setup

1. **Clone the repository**:

   ```sh
   git clone "repository-url"
   ```

   (replace `"repository-url"` with the actual URL).

2. **Install dependencies from the repo root** — one command installs all three packages:

   ```sh
   npm install
   ```

3. **Add your environment files**:
   - `functions/.secret.local` — **required for local chat**. Holds `OPENAI_API_KEY=sk-...` for the Functions emulator (gitignored). The deployed function reads the key from Secret Manager instead.

     ```
     OPENAI_API_KEY=sk-...
     ```

   - `client/.env` — optional. `VITE_API_URL` overrides the chat endpoint; not needed for normal dev (defaults to `/api/chat` → emulator) or prod (set in `client/.env.production`). See `client/.env.example`.

4. **Firebase setup** (the Firebase CLI runs the emulators for local dev and performs deploys):
   - Install the Firebase CLI globally:

     ```sh
     npm install -g firebase-tools
     ```

   - Authenticate with the Google account that has access to the project:

     ```sh
     firebase login
     ```

   - Verify the project alias resolves (should print `codefit-ai-js`):

     ```sh
     firebase use
     ```

   - For deployed Cloud Functions, the OpenAI key is stored as a Secret Manager secret (the deployed analog of `functions/.secret.local`):

     ```sh
     firebase functions:secrets:set OPENAI_API_KEY
     ```

     ⚠️ On Windows, don't pipe the value through PowerShell stdin — it injects a UTF-8 BOM that corrupts the key (the OpenAI call then 500s). Paste it when prompted, or use `--data-file <ascii-file>`.

   - **Plan requirement:** Cloud Functions calling external APIs (like OpenAI) requires the project to be on the **Blaze (pay-as-you-go)** plan. Spark/free tier covers Hosting and basic Firestore but not the chat function. Upgrade **before** the first deploy.

### Day-to-Day Development

Always pull before starting work:

```sh
git pull
```

Start the Vite client (port **8080**) and the Firebase emulators — Functions (**5001**), Auth (**9099**), Firestore (**8085**) — with a single command from the repo root. The Firestore emulator needs a JDK installed.

```sh
npm run dev
```

To run only one piece:

```sh
npm run dev -w client      # Vite client only
npm run emulators          # Firebase emulator suite only
```

### Formatting & Linting

Prettier and ESLint are wired up at the repo root. Run before committing:

```sh
npm run format         # write formatting changes
npm run format:check   # check without writing
npm run lint           # ESLint over client/ and functions/
```

### Production Build & Preview

```sh
npm run build     # builds client/ to client/dist/
npm run preview   # serves the built client locally
```

### Firebase Deploy

The app is **live at https://codefit-ai-js.web.app**. One command builds the client and deploys Hosting + Functions + Firestore rules:

```sh
npm run firebase:deploy
```

**One-time setup before the first deploy** (Firebase / Cloud console):

- Project on the **Blaze** plan (Cloud Functions requirement).
- OpenAI secret set: `firebase functions:secrets:set OPENAI_API_KEY` (mind the Windows BOM caveat above).
- If the function URL returns a Google **403** after deploying, enable Cloud Run → `chat` → **Allow unauthenticated invocations** (auth is still enforced in-function via the Firebase token).
- Email/Password + Google enabled under Authentication → Sign-in method.

**Prod streaming note:** the production client calls the Cloud Function **directly** (via `VITE_API_URL` in `client/.env.production`), not the `/api/chat` Hosting rewrite, because Hosting buffers Server-Sent Events. The function sets restricted CORS + `no-transform` so the stream isn't gzip-buffered by Google's frontend. See CLAUDE.md → "Deployment" for the full architecture and a troubleshooting table.

Pushing changes: use your preferred Git workflow (VSCode UI or CLI).

## Usage Instructions

This repository contains proprietary code belonging to ${DarkMode} Devs. Access is limited to the company's full-stack engineers, who are authorized to further develop the project in alignment with the company's interests.

## Author

Fernando Trejo / DevFTrejo / NaNTheProgrammer

## License

No License - see License tab for details.

## Useful Links

### Choose A License

- [Choose A License - No Permission / No License](https://choosealicense.com/no-permission/)

### Markdown

- [Markdown Guide](https://www.markdownguide.org/)

### Badges

- [Awesome Badges](https://dev.to/envoy_/150-badges-for-github-pnk)

## Authors/Contributors and Acknowledgements

${DarkMode} Devs and its team of full-stack software engineers have developed this project. External acknowledgements - N/A.

<div align="center">
  <a href="https://github.com/devftrejo">
    <img src="https://avatars.githubusercontent.com/u/86129911?v=4" width="100" height="100">
  </a>
</div>

## Project Status

Active and Under Development.

## Contact Information

For any questions, or for more information, please reach out via our company's Gmail or Discord server.

<div align="center">
   <div id="badges">
       <a href="mailto:darkmodedevs@gmail.com">
         <img src="https://img.shields.io/badge/Gmail-D14836?style=for-the-badge&logo=gmail&logoColor=white" alt="Gmail Badge"/>
       </a>
       <a href="https://discord.gg/HRYrHh9N5u">
         <img src="https://img.shields.io/badge/Discord-7289DA?style=for-the-badge&logo=discord&logoColor=white" alt="Discord Badge"/>
       </a>
   </div>
</div>

## Dev Jokes - Because, why not?!

![Jokes Card](https://readme-jokes.vercel.app/api)
