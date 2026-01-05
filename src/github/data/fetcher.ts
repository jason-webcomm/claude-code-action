import { execFileSync } from "child_process";
import {
  giteaGet,
  PR_ENDPOINT,
  ISSUE_ENDPOINT,
  PR_COMMENTS_ENDPOINT,
  ISSUE_COMMENTS_ENDPOINT,
  PR_COMMITS_ENDPOINT,
  PR_FILES_ENDPOINT,
  USER_ENDPOINT,
} from "../api/client";
import { isIssueCommentEvent, type GiteaContext } from "../context";
import type {
  GiteaComment,
  GiteaFile,
  GiteaIssue,
  GiteaPullRequest,
  GiteaUser,
} from "../types";
import type { CommentWithImages } from "../utils/image-downloader";
import { downloadCommentImages } from "../utils/image-downloader";

/**
 * Extracts the trigger timestamp from the Gitea webhook payload.
 * This timestamp represents when the triggering comment/review/event was created.
 *
 * @param context - Parsed Gitea context from webhook
 * @returns ISO timestamp string or undefined if not available
 */
export function extractTriggerTimestamp(
  context: GiteaContext,
): string | undefined {
  if (isIssueCommentEvent(context)) {
    return context.payload.comment?.created_at || undefined;
  }

  return undefined;
}

/**
 * Filters comments to only include those that existed in their final state before the trigger time.
 * This prevents malicious actors from editing comments after the trigger to inject harmful content.
 *
 * @param comments - Array of Gitea comments to filter
 * @param triggerTime - ISO timestamp of when the trigger comment was created
 * @returns Filtered array of comments that were created and last edited before trigger time
 */
export function filterCommentsToTriggerTime<
  T extends { created_at: string; updated_at?: string },
>(comments: T[], triggerTime: string | undefined): T[] {
  if (!triggerTime) return comments;

  const triggerTimestamp = new Date(triggerTime).getTime();

  return comments.filter((comment) => {
    // Comment must have been created before trigger (not at or after)
    const createdTimestamp = new Date(comment.created_at).getTime();
    if (createdTimestamp >= triggerTimestamp) {
      return false;
    }

    // If comment has been edited, the most recent edit must have occurred before trigger
    const lastEditTime = comment.updated_at;
    if (lastEditTime) {
      const lastEditTimestamp = new Date(lastEditTime).getTime();
      if (lastEditTimestamp >= triggerTimestamp) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Checks if the issue/PR body was edited after the trigger time.
 * This prevents a race condition where an attacker could edit the issue/PR body
 * between when an authorized user triggered Claude and when Claude processes the request.
 *
 * @param contextData - The PR or issue data containing body and edit timestamps
 * @param triggerTime - ISO timestamp of when the trigger event occurred
 * @returns true if the body is safe to use, false if it was edited after trigger
 */
export function isBodySafeToUse(
  contextData: { created_at: string; updated_at?: string },
  triggerTime: string | undefined,
): boolean {
  // If no trigger time is available, we can't validate - allow the body
  // This maintains backwards compatibility for triggers that don't have timestamps
  if (!triggerTime) return true;

  const triggerTimestamp = new Date(triggerTime).getTime();

  // Check if the body was edited after the trigger
  const lastEditTime = contextData.updated_at;
  if (lastEditTime) {
    const lastEditTimestamp = new Date(lastEditTime).getTime();
    if (lastEditTimestamp >= triggerTimestamp) {
      return false;
    }
  }

  return true;
}

type FetchDataParams = {
  repository: string;
  prNumber: string;
  isPR: boolean;
  triggerUsername?: string;
  triggerTime?: string;
};

export type GiteaFileWithSHA = GiteaFile & {
  sha: string;
};

export type FetchDataResult = {
  contextData: GiteaPullRequest | GiteaIssue;
  comments: GiteaComment[];
  changedFiles: GiteaFile[];
  changedFilesWithSHA: GiteaFileWithSHA[];
  imageUrlMap: Map<string, string>;
  triggerDisplayName?: string | null;
};

export async function fetchGiteaData({
  repository,
  prNumber,
  isPR,
  triggerUsername,
  triggerTime,
}: FetchDataParams): Promise<FetchDataResult> {
  const [owner, repo] = repository.split("/");
  if (!owner || !repo) {
    throw new Error("Invalid repository format. Expected 'owner/repo'.");
  }

  console.log(
    `Fetching data for: owner=${owner}, repo=${repo}, prNumber=${prNumber}, isPR=${isPR}`,
  );

  let contextData: GiteaPullRequest | GiteaIssue | null = null;
  let comments: GiteaComment[] = [];
  let changedFiles: GiteaFile[] = [];

  try {
    if (isPR) {
      // Fetch PR data
      const endpoint = PR_ENDPOINT(owner, repo, parseInt(prNumber));
      console.log(`Fetching PR from endpoint: ${endpoint}`);
      const prResult = await giteaGet<GiteaPullRequest>(endpoint);

      contextData = prResult.data;

      // Fetch PR files
      const filesResult = await giteaGet<GiteaFile[]>(
        PR_FILES_ENDPOINT(owner, repo, parseInt(prNumber)),
      );
      changedFiles = filesResult.data;

      // Fetch PR comments using the issue comments endpoint
      // (PRs are a type of issue in Gitea, so conversation comments live there)
      const commentsResult = await giteaGet<GiteaComment[]>(
        ISSUE_COMMENTS_ENDPOINT(owner, repo, parseInt(prNumber)),
      );
      comments = filterCommentsToTriggerTime(commentsResult.data, triggerTime);

      console.log(`Successfully fetched PR #${prNumber} data`);
    } else {
      // Fetch issue data
      const issueResult = await giteaGet<GiteaIssue>(
        ISSUE_ENDPOINT(owner, repo, parseInt(prNumber)),
      );

      contextData = issueResult.data;

      // Fetch issue comments
      const commentsResult = await giteaGet<GiteaComment[]>(
        ISSUE_COMMENTS_ENDPOINT(owner, repo, parseInt(prNumber)),
      );
      comments = filterCommentsToTriggerTime(commentsResult.data, triggerTime);

      console.log(`Successfully fetched issue #${prNumber} data`);
    }
  } catch (error) {
    console.error(`Failed to fetch ${isPR ? "PR" : "issue"} data:`, error);
    throw new Error(`Failed to fetch ${isPR ? "PR" : "issue"} data`);
  }

  // Compute SHAs for changed files only if repository is checked out
  let changedFilesWithSHA: GiteaFileWithSHA[] = [];
  if (isPR && changedFiles.length > 0) {
    // Check if we're in a git repository before attempting SHA computation
    let isGitRepo = false;
    try {
      execFileSync("git", ["rev-parse", "--git-dir"], { stdio: "pipe" });
      isGitRepo = true;
    } catch (err) {
      // Not a git repository yet, will be checked out later
      console.log(
        "Not in a git repository yet, skipping SHA computation for PR files",
      );
    }

    if (isGitRepo) {
      changedFilesWithSHA = changedFiles.map((file) => {
        // Don't compute SHA for deleted files
        if (file.status === "deleted" || file.status === "removed") {
          return {
            ...file,
            sha: "deleted",
          };
        }

        try {
          // Use git hash-object to compute the SHA for the current file content
          const sha = execFileSync("git", ["hash-object", file.filename], {
            encoding: "utf-8",
          }).trim();
          return {
            ...file,
            sha,
          };
        } catch (error) {
          console.warn(`Failed to compute SHA for ${file.filename}:`, error);
          // Return original file without SHA if computation fails
          return {
            ...file,
            sha: "unknown",
          };
        }
      });
    } else {
      // Repository not checked out yet, mark SHAs as pending
      changedFilesWithSHA = changedFiles.map((file) => ({
        ...file,
        sha: "pending",
      }));
    }
  }

  // Prepare all comments for image processing
  const issueComments: CommentWithImages[] = comments
    .filter((c) => c.body)
    .map((c) => ({
      type: "issue_comment" as const,
      id: String(c.id),
      body: c.body,
    }));

  // Add the main issue/PR body if it has content and wasn't edited after trigger
  let mainBody: CommentWithImages[] = [];
  if (contextData.body) {
    if (isBodySafeToUse(contextData, triggerTime)) {
      mainBody = [
        {
          ...(isPR
            ? {
                type: "pr_body" as const,
                pullNumber: prNumber,
                body: contextData.body,
              }
            : {
                type: "issue_body" as const,
                issueNumber: prNumber,
                body: contextData.body,
              }),
        },
      ];
    } else {
      console.warn(
        `Security: ${isPR ? "PR" : "Issue"} #${prNumber} body was edited after the trigger event. ` +
          `Excluding body content to prevent potential injection attacks.`,
      );
    }
  }

  const allComments = [...mainBody, ...issueComments];

  const imageUrlMap = await downloadCommentImages(owner, repo, allComments);

  // Fetch trigger user display name if username is provided
  let triggerDisplayName: string | null | undefined;
  if (triggerUsername) {
    triggerDisplayName = await fetchUserDisplayName(triggerUsername);
  }

  return {
    contextData,
    comments,
    changedFiles,
    changedFilesWithSHA,
    imageUrlMap,
    triggerDisplayName,
  };
}

export async function fetchUserDisplayName(
  login: string,
): Promise<string | null> {
  try {
    const result = await giteaGet<GiteaUser>(USER_ENDPOINT(login));
    return result.data.full_name || result.data.login || null;
  } catch (error) {
    console.warn(`Failed to fetch user display name for ${login}:`, error);
    return null;
  }
}
// Backward compatibility alias
export const fetchGitHubData = fetchGiteaData;

// Backward compatibility type aliases
export type GitHubFileWithSHA = GiteaFileWithSHA;
export type GitHubFile = GiteaFile;
export type GitHubComment = GiteaComment;
export type GitHubUser = GiteaUser;
export type GitHubPullRequest = GiteaPullRequest;
export type GitHubIssue = GiteaIssue;
