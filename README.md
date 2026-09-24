# nomadjing.github.io

This site is built locally from the Obsidian vault at `../Nomad` and published to GitHub Pages. The vault and its PDFs do not need to be uploaded to GitHub. Only generated pages and referenced assets are pushed to the `gh-pages` branch.

## First setup

1. Create an empty public GitHub repository named `nomadjing.github.io` and push this project's source to its `main` branch. Set its `origin` remote to `git@github.com:nomadjing/nomadjing.github.io.git` (HTTPS works too). The local `content/` directory is ignored by Git.
2. On the computer containing the vault, run `npm ci` once.
3. Run `npm run publish:preview` to build and inspect `dist/`. Run `npm run publish` to create and push `gh-pages`.
4. In repository **Settings → Pages → Build and deployment**, select **Deploy from a branch**, choose `gh-pages` and `/(root)`.

The source workflow in `.github/workflows/check.yml` checks TypeScript and tests on pushes to `main`. GitHub Pages publishes the generated `gh-pages` branch. Because the vault is local, GitHub Actions cannot perform the site build. There is no need for a token or private-vault secret in GitHub Actions.

## Publish updates

Edit notes in the vault and mark the ones intended for the public site with YAML frontmatter `publish: true`. Then run:

```sh
npm run publish:preview
npm run publish
```

`publish:preview` runs checks and builds `dist/` without pushing. `publish` repeats those checks, builds from the vault, and pushes only the contents of `dist/` to `gh-pages`. Set `CONTENT_ROOT=/absolute/path/to/vault` to override the default `../Nomad` location.

Before publishing, inspect `dist/`, especially `garden-index.json`, which includes the text of published notes. Removing a published note later does not remove previously published copies from Git history or external archives. Keep private material out of notes marked `publish: true`.

The publish command refuses to run if the vault is missing or has no published notes. It checks that `origin` points to `nomadjing/nomadjing.github.io` before pushing.
