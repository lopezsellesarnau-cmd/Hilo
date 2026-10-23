// App Store review account. Apple's reviewers can't read the emailed code, so this one address
// signs in with a password instead (user created by hand in Supabase, Auto Confirm on).
// It's a normal family account with sample data, no special rights.
export const REVIEW_EMAIL = 'appreview@hilo.test';

export const isReviewEmail = (email: string) => email.trim().toLowerCase() === REVIEW_EMAIL;
