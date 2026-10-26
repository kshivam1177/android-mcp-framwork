# Release checklist

This repository uses `dev` for integration and `master` for stable publication. Do not publish from an unverified working tree.

## 1. Verify the release candidate

Run on a clean checkout of the exact commit intended for release:

```bash
npm ci
npm run build
npm run typecheck
npm run lint
npm test
npm pack --dry-run
```

Review the npm pack listing and ensure it contains the built CLI, required runtime files, license, README, and relevant documentation without local secrets, test reports, or development-only files.

## 2. Verify the npm package name and account

The current manifest uses the unscoped name `androidbuildmcp`. Before publishing, check whether the name is available and whether your npm account is allowed to publish it:

```bash
npm view androidbuildmcp name version
npm whoami
```

If the name is already owned, choose an available scoped package name (for example, one under your own npm username), update `package.json` and regenerate `package-lock.json` with `npm install --package-lock-only`. Do not attempt to overwrite another publisher's package.

## 3. Publish npm

After successful checks and a reviewed version bump:

```bash
npm login
npm publish
```

For subsequent releases, increment the package version first. Consider configuring npm trusted publishing for GitHub Actions once the package is created and the repository/workflow identity is registered with npm. Never commit an npm token.

## 4. Publish the documentation website

The static site lives in `docs-site/`. The Pages workflow deploys it from `master` when the site or workflow changes.

1. Merge the reviewed release candidate into `master` after resolving any branch divergence.
2. In GitHub, open **Settings → Pages** and select **GitHub Actions** as the build/deployment source.
3. Confirm the **Deploy documentation** workflow succeeds.
4. Verify the published site at `https://kshivam1177.github.io/android-build-mcp/` and check its links.

The website is not live merely because the files exist in the repository; Pages must be enabled and a deployment must succeed.

## 5. GitHub release

After CI passes on the exact stable commit, create a version tag and GitHub Release with concise notes covering changes, known limitations, supported Node.js version, and setup instructions. Keep package and Git tags aligned (for example, package version `0.1.0` with tag `v0.1.0`).

## Current publication blockers

- The full CI workflow has been added but its build, type-check, lint, and test results still need to be confirmed in GitHub Actions.
- The stable branch must be reconciled with `dev` and reviewed before deploying the site.
- npm package-name availability and publisher permissions have not been confirmed.
- No npm release or live Pages deployment has been performed by this checklist.
