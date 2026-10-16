# Working in this repo

Static site (no build step): `index.html` (login), `home.html`, `auth.js`, `bubbles.js`, `style.css`.

## Change workflow

1. **Branch per feature, named after it.** Short kebab-case keywords describing the
   change, e.g. `hide-login-button`, `bubble-pop-sound`, `fix-password-toggle`.
   Branch from the latest `main`; never reuse a merged branch.
2. **Push and open a PR** against `main`.
3. **Preview on GitHub Pages.** Every push to a non-`main` branch is deployed by
   `.github/workflows/pages.yml` to
   `https://igincan.github.io/claude-test/preview/<branch>/` (slashes in the branch
   name become `-`). Wait for the workflow to finish and give the user the preview link.
4. **Do not merge until the user has tested the preview and says to merge.**
   Merging to `main` deploys to `https://igincan.github.io/claude-test/`; deleting the
   branch afterwards removes its preview.
