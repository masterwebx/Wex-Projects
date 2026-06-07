# Practice Test

Spaced repetition study app with mock exams, readiness tracking, and offline practice.

## Development

```bash
cd projects/practice-test
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Build for GitHub Pages

```bash
npm run build:pages
```

Output goes to `dist/`. The site is served at `/Wex-Projects/projects/practice-test/dist/` on GitHub Pages. The root `index.html` redirects there for convenience.

## Tests

```bash
npm test          # unit tests
npm run test:e2e  # Playwright (starts dev server)
```
