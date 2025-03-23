export const USERNAME_REGEX = /@[a-z](?:[a-z0-9]*(?:[-._][a-z0-9]+)*){2,}/g;
export const PIVOTAL_ID_REGEX = /^#\d+$/;

export const LINEAR_COMMENT_PIVOTAL_ID_PREFIX = "Pivotal ID: #";
export const LINEAR_COMMENT_PIVOTAL_ID_REGEX = new RegExp(
  `^${LINEAR_COMMENT_PIVOTAL_ID_PREFIX.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}\\d+`,
);
