# Fix Messages page showing Matches

## Steps
- [x] Step 1: Edit `src/components/Matches.js` to differentiate Messages view
  - Hide "Likes You" section when `isMessagesPage` is true
  - Filter matches to only those with conversations on Messages page
  - Update tab labels (rename default tab to "Conversations", hide "Who Liked You")
  - Update empty-state text for Messages
  - Fix heading count to reflect filtered list
- [x] Step 2: Update `src/App.test.js` to assert new Messages empty-state text
- [x] Step 3: Run tests to verify no regressions
  - The modified "messages route" test passes
  - Other pre-existing test failures are unrelated to this change

