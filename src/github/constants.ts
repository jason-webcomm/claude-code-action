/**
 * Gitea-related constants used throughout the application
 */

/**
 * Gitea API version
 */
export const GITEA_API_VERSION = "v1";

/**
 * Gitea Actions status values
 */
export const GITEA_ACTIONS_STATUS = {
  SUCCESS: "success",
  FAILURE: "failure",
  PENDING: "pending",
  RUNNING: "running",
  CANCELLED: "cancelled",
  SKIPPED: "skipped",
} as const;

/**
 * Gitea PR/Issue states
 */
export const GITEA_PR_STATE = {
  OPEN: "open",
  CLOSED: "closed",
} as const;

export const GITEA_ISSUE_STATE = {
  OPEN: "open",
  CLOSED: "closed",
} as const;

/**
 * Gitea permission levels
 */
export const GITEA_PERMISSION_LEVELS = {
  OWNER: "owner",
  ADMIN: "admin",
  WRITE: "write",
  READ: "read",
  NONE: "none",
} as const;

/**
 * Gitea webhook event names
 */
export const GITEA_WEBHOOK_EVENTS = {
  PULL_REQUEST: "pull_request",
  ISSUES: "issues",
  ISSUE_COMMENT: "issue_comment",
  PUSH: "push",
  RELEASE: "release",
} as const;

/**
 * Gitea webhook actions
 */
export const GITEA_WEBHOOK_ACTIONS = {
  OPENED: "opened",
  EDITED: "edited",
  CLOSED: "closed",
  REOPENED: "reopened",
  SYNCHRONIZED: "synchronized",
  CREATED: "created",
  DELETED: "deleted",
  PUBLISHED: "published",
} as const;

/**
 * Claude bot identifiers
 */
export const CLAUDE_APP_BOT_ID = 67639;
export const CLAUDE_BOT_LOGIN = "claude[bot]";
