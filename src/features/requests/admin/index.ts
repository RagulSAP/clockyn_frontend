// Admin / manager request inbox. Public surface for other features (e.g. the Home "Requests" tile).
export { useRequestBadges } from './hooks/useRequestBadges';
export type { RequestBadges } from './hooks/useRequestBadges';
export { REQUESTS_POLL_MS } from './hooks/useAdminRequests';
export { badgeText } from './utils/badgeLogic';
