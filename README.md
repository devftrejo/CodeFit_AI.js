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
         <img src="https://img.shields.io/badge/Express.js-404D59?style=for-the-badge" alt="Express JS Badge"/>
       </a>
   </div>
</div>

#### NOTE: This can change at any time during the project's growth and development.

## Repository Layout

This repo is an **npm workspace** with two packages:

```
client/   Vite MPA — vanilla JS ES modules, CodeMirror 6 + marked + Font Awesome (all bundled from npm)
server/   Express API — single POST / endpoint that streams OpenAI chat completions; owns the AI system prompts
```

All dependencies for both packages hoist to a single root `node_modules/`, so you install once at the root.

The client ships four pages:

- `/` — landing
- `/app.html` — the chat + code-sandbox app
- `/about.html` — about
- `/contact.html` — contact

All four share a top-bar nav. The chat app additionally has an off-canvas navbar for the Curriculum and AI Roles menus.

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

2. **Install dependencies from the repo root** — one command installs both packages:

   ```sh
   npm install
   ```

3. **Add your environment files**:
   - `server/.env` — **required**. Holds your `OPENAI_API_KEY`. Without it the `POST /` endpoint returns 500:

     ```
     OPENAI_API_KEY=sk-...
     ```

   - `client/.env` — optional. Only needed if your server runs somewhere other than `http://localhost:3000/`. Copy `client/.env.example` and edit `VITE_API_URL`.

### Day-to-Day Development

Always pull before starting work:

```sh
git pull
```

Start both the Vite client (port **8080**) and the Express server (port **3000**) with a single command from the repo root:

```sh
npm run dev
```

To run only one side independently:

```sh
npm run dev -w client      # Vite client only
npm run watch -w server    # Nodemon-restarted Express server only
```

### Formatting & Linting

Prettier and ESLint are wired up at the repo root. Run before committing:

```sh
npm run format         # write formatting changes
npm run format:check   # check without writing
npm run lint           # ESLint over client/ and server/
```

### Production Build & Preview

```sh
npm run build     # builds client/ to client/dist/
npm run preview   # serves the built client locally
```

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
       <a href="https://discord.gg/2D8pARQFjt">
         <img src="https://img.shields.io/badge/Discord-7289DA?style=for-the-badge&logo=discord&logoColor=white" alt="Discord Badge"/>
       </a>
   </div>
</div>

## Dev Jokes - Because, why not?!

![Jokes Card](https://readme-jokes.vercel.app/api)
