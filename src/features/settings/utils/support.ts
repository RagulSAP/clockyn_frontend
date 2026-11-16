export const SUGGEST_SUBJECT_MAX = 120;
export const SUGGEST_MESSAGE_MAX = 1000;
export const SUGGEST_REDIRECT_DELAY_MS = 1800;

/** First validation problem of the feature-suggestion form, or null. */
export function validateSuggestion(subject: string, content: string): string | null {
  if (subject.trim() === '') return 'Please enter a subject';
  if (content.trim() === '') return 'Please enter your message';
  return null;
}
