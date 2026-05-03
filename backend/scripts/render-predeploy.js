const { seedGooglePlayReviewers } = require('./create-google-play-reviewers');

const shouldSeedReviewers = () => {
  const rawValue = String(process.env.SEED_GOOGLE_PLAY_REVIEWERS || 'true').trim().toLowerCase();
  return !['false', '0', 'no', 'off'].includes(rawValue);
};

const run = async () => {
  console.log('Render pre-deploy tasks started.');

  if (!shouldSeedReviewers()) {
    console.log('Skipping Google Play reviewer seeding because SEED_GOOGLE_PLAY_REVIEWERS is disabled.');
    return;
  }

  console.log('Seeding Google Play reviewer accounts...');
  await seedGooglePlayReviewers();
  console.log('Render pre-deploy tasks completed.');
};

run().catch((error) => {
  console.error('Render pre-deploy failed:', error.message);
  process.exitCode = 1;
});
