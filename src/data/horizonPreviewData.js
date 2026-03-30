export const HORIZON_SESSION_STORAGE_KEY = 'horizon_access_session';

export const HORIZON_PREVIEW_USER = {
  id: 'preview-guest',
  name: 'Preview Guest',
  email: 'preview@horizon.local',
  company: 'Read-only sandbox',
  role: 'Explorer',
  isPreview: true,
};

export const HORIZON_PREVIEW_WORKSPACE = {
  id: 'preview-workspace',
  name: 'Signals Preview',
  description: 'Read-only demo workspace for exploring Horizon before access is activated.',
  vertical: 'saas',
  analyses_count: 1,
};

export const HORIZON_PREVIEW_CONNECTORS = [
  {
    id: 'preview-appstore',
    connector_type: 'appstore',
    identifier: 'orbitflow-ios',
    name: 'App Store: OrbitFlow',
    config: { country: 'us', max_reviews: 120 },
  },
  {
    id: 'preview-playstore',
    connector_type: 'playstore',
    identifier: 'com.orbitflow.mobile',
    name: 'Play Store: OrbitFlow',
    config: { country: 'us', max_reviews: 120 },
  },
  {
    id: 'preview-typeform',
    connector_type: 'typeform',
    identifier: 'preview-form',
    name: 'Typeform: Trial Exit Survey',
    config: { max_reviews: 80 },
  },
];

export const HORIZON_PREVIEW_REVIEWS = [
  {
    id: 'preview-001',
    date: '2026-03-21',
    source: 'App Store',
    score: 5,
    content: 'The weekly executive summary is incredibly clear. Our product team finally sees the same themes every Monday morning.',
  },
  {
    id: 'preview-002',
    date: '2026-03-20',
    source: 'Play Store',
    score: 2,
    content: 'The Android app keeps timing out when I upload large CSV files, so our QA team has to retry the import over and over.',
  },
  {
    id: 'preview-003',
    date: '2026-03-19',
    source: 'Typeform',
    score: 3,
    content: 'Setup was smooth, but I expected alerts when churn-risk feedback spikes instead of checking the dashboard manually.',
  },
  {
    id: 'preview-004',
    date: '2026-03-18',
    source: 'App Store',
    score: 4,
    content: 'Great product for fast triage. Would love a cleaner way to assign owners to the top issues without leaving Horizon.',
  },
  {
    id: 'preview-005',
    date: '2026-03-18',
    source: 'Play Store',
    score: 1,
    content: 'The latest release broke logins for half our field reps, and support only replied after two days.',
  },
  {
    id: 'preview-006',
    date: '2026-03-17',
    source: 'Typeform',
    score: 4,
    content: 'We use the preview tables during launch reviews because the filters make it easy to isolate feedback from one campaign.',
  },
  {
    id: 'preview-007',
    date: '2026-03-16',
    source: 'App Store',
    score: 5,
    content: 'Love the connector setup flow. We added App Store and survey data in a few minutes and the workspace stayed tidy.',
  },
  {
    id: 'preview-008',
    date: '2026-03-15',
    source: 'Play Store',
    score: 2,
    content: 'Insight quality looks promising, but export access being locked to enterprise plans makes the rollout hard for smaller teams.',
  },
];
