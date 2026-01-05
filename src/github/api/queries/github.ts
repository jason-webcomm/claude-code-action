// REST API endpoints for Gitea data

/**
 * Fetch Pull Request data
 * GET /repos/{owner}/{repo}/pulls/{index}
 */
export const PR_ENDPOINT = (owner: string, repo: string, number: number) =>
  `/repos/${owner}/${repo}/pulls/${number}`;

/**
 * Fetch Issue data
 * GET /repos/{owner}/{repo}/issues/{index}
 */
export const ISSUE_ENDPOINT = (owner: string, repo: string, number: number) =>
  `/repos/${owner}/${repo}/issues/${number}`;

/**
 * Fetch Pull Request comments
 * GET /repos/{owner}/{repo}/issues/{index}/comments
 */
export const PR_COMMENTS_ENDPOINT = (
  owner: string,
  repo: string,
  number: number,
) => `/repos/${owner}/${repo}/issues/${number}/comments`;

/**
 * Fetch Issue comments
 * GET /repos/{owner}/{repo}/issues/{index}/comments
 */
export const ISSUE_COMMENTS_ENDPOINT = (
  owner: string,
  repo: string,
  number: number,
) => `/repos/${owner}/${repo}/issues/${number}/comments`;

/**
 * Fetch user data
 * GET /users/{username}
 */
export const USER_ENDPOINT = (username: string) => `/users/${username}`;

/**
 * Fetch Pull Request commits
 * GET /repos/{owner}/{repo}/pulls/{index}/commits
 */
export const PR_COMMITS_ENDPOINT = (
  owner: string,
  repo: string,
  number: number,
) => `/repos/${owner}/${repo}/pulls/${number}/commits`;

/**
 * Fetch Pull Request files
 * GET /repos/{owner}/{repo}/pulls/{index}/files
 */
export const PR_FILES_ENDPOINT = (
  owner: string,
  repo: string,
  number: number,
) => `/repos/${owner}/${repo}/pulls/${number}/files`;
