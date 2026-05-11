# DatingHub - Play Store Submission Checklist

Date: May 4, 2026
Package ID: com.linkup.datinghub
Version: 1.0.1 (versionCode 2)

## Reviewer Access

- [ ] Run `npm run reviewers:create` from `backend`
- [ ] Confirm these accounts can log in from the app using the `MPIN` tab:
  - `reviewer1@linkupdating.com` / `2468`
  - `reviewer2@linkupdating.com` / `1357`
  - `reviewer3@linkupdating.com` / `8080`
- [ ] Verify Reviewer 1 already has:
  - An active match with Reviewer 2
  - Seeded chat messages
  - A pending like from Reviewer 3
- [ ] Paste `GOOGLE_PLAY_REVIEWER_INSTRUCTIONS.md` into Play Console `App access`

## Build Readiness

- [ ] Build web assets with `npm run build`
- [ ] Build Android output from the `android` folder
- [ ] Confirm release signing values are present before generating the AAB
- [ ] Upload `app-release.aab` for version 1.0.1 / code 2

## Play Console

- [ ] App created with package ID `com.linkup.datinghub`
- [ ] Category set to `Lifestyle` / `Dating`
- [ ] Age target set to adults 18+
- [ ] Data safety and app access sections completed
- [ ] Privacy policy URL added
- [ ] Support email added

## In-App Checks

- [ ] Login works with seeded reviewer credentials
- [ ] Messages load and send successfully
- [ ] Likes and match flows work
- [ ] Profile and settings open without errors
- [ ] Legal pages are reachable
- [ ] Account deletion flow is visible

## Release Notes Before Upload

- [ ] Main Android package values all match `com.linkup.datinghub`
- [ ] Reviewer instructions do not mention unsupported or unnecessary login paths
- [ ] No localhost URLs are used in production config
- [ ] No sensitive keys or secrets are exposed in the build
