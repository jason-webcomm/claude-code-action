#!/usr/bin/env bun

/**
 * Create the initial tracking comment when Claude Code starts working
 * This comment shows the working status and includes a link to the job run
 */

import { appendFileSync } from "fs";
import { createJobRunLink, createCommentBody } from "./common";
import {
  isIssueCommentEvent,
  isPullRequestEvent,
  type GiteaContext,
} from "../../context";
import { GITEA_API_URL } from "../../api/config";

/**
 * Fetch the correct run number from Gitea API
 * Gitea Actions' github.run_id provides an internal tracking ID, not the UI run number
 */
async function getGiteaRunNumber(
  owner: string,
  repo: string,
  giteaToken: string,
): Promise<string> {
  try {
    // Query the most recent runs to find the current one
    // GET /repos/{owner}/{repo}/actions/runs
    const runsUrl = `${GITEA_API_URL}/repos/${owner}/${repo}/actions/runs`;
    const response = await fetch(runsUrl, {
      headers: {
        Accept: "application/json",
        Authorization: `token ${giteaToken}`,
      },
    });

    if (!response.ok) {
      return "";
    }

    const data = await response.json();

    // Get the most recent run (first in the list)
    if (data.workflow_runs && data.workflow_runs.length > 0) {
      const latestRun = data.workflow_runs[0];
      // Return the run_number which is what appears in the UI URL
      return latestRun.run_number.toString();
    }

    return "";
  } catch (error) {
    return "";
  }
}

export async function createInitialComment(
  giteaToken: string,
  context: GiteaContext,
) {
  const { owner, repo } = context.repository;

  // Fetch the correct run number from Gitea API
  const runNumber = await getGiteaRunNumber(owner, repo, giteaToken);
  const jobRunLink = createJobRunLink(owner, repo, runNumber || context.runId);
  const initialBody = createCommentBody(jobRunLink);

  try {
    let response;

    if (
      context.inputs.useStickyComment &&
      context.isPR &&
      isPullRequestEvent(context)
    ) {
      // For sticky comments in PRs, try to find an existing Claude comment
      // GET /repos/{owner}/{repo}/issues/{index}/comments
      const commentsUrl = `${GITEA_API_URL}/repos/${owner}/${repo}/issues/comments`;
      const commentsResponse = await fetch(commentsUrl, {
        headers: {
          Accept: "application/json",
          Authorization: `token ${giteaToken}`,
        },
      });

      if (!commentsResponse.ok) {
        throw new Error(
          `Failed to list comments: ${commentsResponse.status} - ${await commentsResponse.text()}`,
        );
      }

      const comments = (await commentsResponse.json()) as Array<{
        id: number;
        user: { login: string; full_name?: string };
        body: string;
      }>;

      // Look for existing Claude comment (matching by body or user)
      const existingComment = comments.find((comment) => {
        const bodyMatch = comment.body === initialBody;
        const botNameMatch =
          comment.user.login.toLowerCase().includes("claude") ||
          comment.user.full_name?.toLowerCase().includes("claude");

        return bodyMatch || botNameMatch;
      });

      if (existingComment) {
        // Update existing comment
        // PATCH /repos/{owner}/{repo}/issues/comments/{id}
        const updateUrl = `${GITEA_API_URL}/repos/${owner}/${repo}/issues/comments/${existingComment.id}`;
        response = await fetch(updateUrl, {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `token ${giteaToken}`,
          },
          body: JSON.stringify({
            body: initialBody,
          }),
        });

        if (!response.ok) {
          throw new Error(
            `Failed to update comment: ${response.status} - ${await response.text()}`,
          );
        }
      } else {
        // Create new comment
        // POST /repos/{owner}/{repo}/issues/{index}/comments
        const createUrl = `${GITEA_API_URL}/repos/${owner}/${repo}/issues/${context.entityNumber}/comments`;
        response = await fetch(createUrl, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `token ${giteaToken}`,
          },
          body: JSON.stringify({
            body: initialBody,
          }),
        });

        if (!response.ok) {
          throw new Error(
            `Failed to create comment: ${response.status} - ${await response.text()}`,
          );
        }
      }
    } else if (isIssueCommentEvent(context) && context.payload.comment?.id) {
      // For issue comment events, reply to the original comment
      // POST /repos/{owner}/{repo}/issues/comments/{id}
      const replyUrl = `${GITEA_API_URL}/repos/${owner}/${repo}/issues/${context.entityNumber}/comments`;
      response = await fetch(replyUrl, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `token ${giteaToken}`,
        },
        body: JSON.stringify({
          body: initialBody,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to create reply comment: ${response.status} - ${await response.text()}`,
        );
      }
    } else {
      // For all other cases (issues, PRs), create a regular issue/PR comment
      // POST /repos/{owner}/{repo}/issues/{index}/comments
      const createUrl = `${GITEA_API_URL}/repos/${owner}/${repo}/issues/${context.entityNumber}/comments`;
      response = await fetch(createUrl, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `token ${giteaToken}`,
        },
        body: JSON.stringify({
          body: initialBody,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to create comment: ${response.status} - ${await response.text()}`,
        );
      }
    }

    const data = (await response.json()) as { id: number };

    // Output the comment ID for downstream steps using GITEA_OUTPUT
    const giteaOutput = process.env.GITEA_OUTPUT || process.env.GITHUB_OUTPUT!;
    appendFileSync(giteaOutput, `claude_comment_id=${data.id}\n`);
    console.log(`✅ Created initial comment with ID: ${data.id}`);
    return data;
  } catch (error) {
    console.error("Error in initial comment:", error);

    // Always fall back to regular issue comment if anything fails
    try {
      const createUrl = `${GITEA_API_URL}/repos/${owner}/${repo}/issues/${context.entityNumber}/comments`;
      const response = await fetch(createUrl, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `token ${giteaToken}`,
        },
        body: JSON.stringify({
          body: initialBody,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to create fallback comment: ${response.status} - ${await response.text()}`,
        );
      }

      const data = (await response.json()) as { id: number };

      const giteaOutput =
        process.env.GITEA_OUTPUT || process.env.GITHUB_OUTPUT!;
      appendFileSync(giteaOutput, `claude_comment_id=${data.id}\n`);
      console.log(`✅ Created fallback comment with ID: ${data.id}`);
      return data;
    } catch (fallbackError) {
      console.error("Error creating fallback comment:", fallbackError);
      throw fallbackError;
    }
  }
}
