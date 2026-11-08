// Secrets aren't in wrangler.jsonc, so `wrangler types` can't see them. They are optional on
// purpose: a Worker with a missing secret still has to keep every lead. Not declared through
// `secrets.required`, because that makes a deploy fail until each secret is set.
interface Env {
  REDDIT_CAPI_TOKEN?: string;
  TURNSTILE_SECRET?: string;
  IP_SALT?: string;
  // Absent means GA4 sending is off, quietly.
  GA4_API_SECRET?: string;
  // Set to 'true' only to test: sends to Google's validation endpoint, which records nothing.
  GA4_DEBUG?: string;
  // Absent means Meta's Conversions API is off, quietly.
  META_CAPI_TOKEN?: string;
}
