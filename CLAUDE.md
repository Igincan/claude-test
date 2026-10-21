# Working in this repo

Static site (no build step): `index.html` loads `config.js`, `countdown.js` and
`bubbles.js` (the hearts playground); styles in `style.css`.

The background countdown's target and label come from the repository variables
`COUNTDOWN_TARGET` (e.g. `2026-10-24T12:00`) and `COUNTDOWN_LABEL`, which `pages.yml`
writes into `config.js` on deploy. Empty -> next Saturday noon / "until Saturday noon".
After changing them, re-run the "GitHub Pages" workflow on `main` to redeploy.

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
   Merging to `main` deploys to `https://igincan.github.io/claude-test/`.
5. **Branches are deleted after merging.** Merging a PR (on GitHub or via Claude)
   makes `pages.yml` delete the branch and its preview automatically. Delete the local
   copy too.
