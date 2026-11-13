// User-Agent patterns of well-known crawlers. Shared by proxy.ts (rate-limit
// ceilings, dashboard 403s) and /dashboard/traffic (labelling rows).
// A User-Agent is self-declared and trivially faked: these say what a client
// CLAIMS to be, never what it is.

/** Search engine crawlers. */
export const SEARCH_ENGINE_BOT_RE =
  /googlebot|bingbot|yandexbot|baiduspider|duckduckbot|slurp|msnbot|apis-google|mediapartners-google|adsbot-google/i;

/** Social / link-preview crawlers. */
export const SOCIAL_BOT_RE =
  /facebookexternalhit|meta-externalagent|meta-webindexer|Twitterbot|LinkedInBot|WhatsApp|Pinterestbot|Slackbot|Discordbot|TelegramBot/i;
