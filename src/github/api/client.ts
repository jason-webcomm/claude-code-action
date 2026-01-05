import { GITEA_API_URL, GITEA_TOKEN } from "./config";

/**
 * Gitea REST API client helper functions
 */

/**
 * Gitea API endpoint builders
 */
export function ISSUE_ENDPOINT(
  owner: string,
  repo: string,
  issueNumber: number,
): string {
  return `/repos/${owner}/${repo}/issues/${issueNumber}`;
}

export function PR_ENDPOINT(
  owner: string,
  repo: string,
  prNumber: number,
): string {
  return `/repos/${owner}/${repo}/pulls/${prNumber}`;
}

export function ISSUE_COMMENTS_ENDPOINT(
  owner: string,
  repo: string,
  issueNumber: number,
): string {
  return `/repos/${owner}/${repo}/issues/${issueNumber}/comments`;
}

export function PR_COMMENTS_ENDPOINT(
  owner: string,
  repo: string,
  prNumber: number,
): string {
  return `/repos/${owner}/${repo}/pulls/${prNumber}/comments`;
}

export function PR_COMMITS_ENDPOINT(
  owner: string,
  repo: string,
  prNumber: number,
): string {
  return `/repos/${owner}/${repo}/pulls/${prNumber}/commits`;
}

export function PR_FILES_ENDPOINT(
  owner: string,
  repo: string,
  prNumber: number,
): string {
  return `/repos/${owner}/${repo}/pulls/${prNumber}/files`;
}

export function USER_ENDPOINT(username: string): string {
  return `/users/${username}`;
}

export type GiteaApiResponse<T> = {
  data: T;
  status: number;
  headers: Headers;
};

/**
 * Make a GET request to Gitea API
 */
export async function giteaGet<T>(
  endpoint: string,
  params?: Record<string, string | number | boolean>,
): Promise<GiteaApiResponse<T>> {
  const url = new URL(`${GITEA_API_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });
  }

  console.log(`Gitea API GET request: ${url.toString()}`);

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `token ${GITEA_TOKEN}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    console.error(
      `Gitea API request failed: ${response.status} ${response.statusText}`,
    );
    console.error(`Request URL: ${url.toString()}`);
    throw new Error(
      `Gitea API request failed: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as T;
  return { data, status: response.status, headers: response.headers };
}

/**
 * Make a POST request to Gitea API
 */
export async function giteaPost<T>(
  endpoint: string,
  body?: unknown,
): Promise<GiteaApiResponse<T>> {
  const response = await fetch(`${GITEA_API_URL}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `token ${GITEA_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(
      `Gitea API request failed: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as T;
  return { data, status: response.status, headers: response.headers };
}

/**
 * Make a PUT request to Gitea API
 */
export async function giteaPut<T>(
  endpoint: string,
  body?: unknown,
): Promise<GiteaApiResponse<T>> {
  const response = await fetch(`${GITEA_API_URL}${endpoint}`, {
    method: "PUT",
    headers: {
      Authorization: `token ${GITEA_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(
      `Gitea API request failed: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as T;
  return { data, status: response.status, headers: response.headers };
}

/**
 * Make a PATCH request to Gitea API
 */
export async function giteaPatch<T>(
  endpoint: string,
  body?: unknown,
): Promise<GiteaApiResponse<T>> {
  const response = await fetch(`${GITEA_API_URL}${endpoint}`, {
    method: "PATCH",
    headers: {
      Authorization: `token ${GITEA_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(
      `Gitea API request failed: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as T;
  return { data, status: response.status, headers: response.headers };
}

/**
 * Make a DELETE request to Gitea API
 */
export async function giteaDelete<T>(
  endpoint: string,
): Promise<GiteaApiResponse<T>> {
  const response = await fetch(`${GITEA_API_URL}${endpoint}`, {
    method: "DELETE",
    headers: {
      Authorization: `token ${GITEA_TOKEN}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Gitea API request failed: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as T;
  return { data, status: response.status, headers: response.headers };
}
