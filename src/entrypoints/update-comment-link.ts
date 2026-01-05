#!/usr/bin/env bun

import * as fs from "fs/promises";
import {
  updateCommentBody,
  type CommentUpdateInput,
} from "../github/operations/comment-logic";
import {
  parseGiteaContext,
  isIssueCommentEvent,
  isEntityContext,
} from "../github/context";
import { GITEA_SERVER_URL, GITEA_API_URL } from "../github/api/config";
import { updateClaudeComment } from "../github/operations/comments/update-claude-comment";

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

async function run() {
  try {
    const commentId = parseInt(process.env.CLAUDE_COMMENT_ID!);
    const giteaToken = process.env.GITEA_TOKEN!;
    const claudeBranch = process.env.CLAUDE_BRANCH;
    const baseBranch = process.env.BASE_BRANCH || "main";
    const triggerUsername = process.env.TRIGGER_USERNAME;

    const context = parseGiteaContext();

    // This script is only called for entity-based events
    if (!isEntityContext(context)) {
      throw new Error("update-comment-link requires an entity context");
    }

    const { owner, repo } = context.repository;

    // Fetch the correct run number from Gitea API
    const runNumber = await getGiteaRunNumber(owner, repo, giteaToken);
    const serverUrl = GITEA_SERVER_URL;
    const jobUrl = `${serverUrl}/${owner}/${repo}/actions/runs/${runNumber || process.env.GITEA_RUN_ID}`;

    let comment;
    let isPRComment = false;

    try {
      // For Gitea, we use the same API endpoint for all comments
      // GET /repos/{owner}/{repo}/issues/comments/{id}
      const commentUrl = `${GITEA_API_URL}/repos/${owner}/${repo}/issues/comments/${commentId}`;
      const response = await fetch(commentUrl, {
        headers: {
          Accept: "application/json",
          Authorization: `token ${giteaToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch comment: ${response.status} - ${await response.text()}`,
        );
      }

      comment = (await response.json()) as { body: string };
      isPRComment = context.isPR;
      console.log(
        `Successfully fetched ${isPRComment ? "PR" : "issue"} comment`,
      );
    } catch (finalError) {
      // If fetching fails, try to determine more information about the comment
      console.error("Failed to fetch comment. Debug info:");
      console.error(`Comment ID: ${commentId}`);
      console.error(`Event name: ${context.eventName}`);
      console.error(`Entity number: ${context.entityNumber}`);
      console.error(`Repository: ${context.repository.full_name}`);

      throw finalError;
    }

    const currentBody = comment.body ?? "";

    // Check if we need to add branch link for new branches
    const useCommitSigning = process.env.USE_COMMIT_SIGNING === "true";

    // For Gitea, we don't have a separate branch-cleanup module
    // We'll handle this inline
    let shouldDeleteBranch = false;
    let branchLink = "";

    if (claudeBranch) {
      if (!useCommitSigning) {
        // Check if branch exists in remote
        const branchRefUrl = `${GITEA_API_URL}/repos/${owner}/${repo}/git/refs/heads/${claudeBranch}`;
        const branchRefResponse = await fetch(branchRefUrl, {
          headers: {
            Accept: "application/json",
            Authorization: `token ${giteaToken}`,
          },
        });

        if (branchRefResponse.ok) {
          // Branch exists, add link
          const branchUrl = `${GITEA_SERVER_URL}/${owner}/${repo}/src/branch/${claudeBranch}`;
          branchLink = `\n[View branch](${branchUrl})`;
        } else {
          // Branch doesn't exist (was never created or was deleted)
          shouldDeleteBranch = true;
        }
      } else {
        // For commit signing mode, we need to check if the branch was created
        // This is more complex with Gitea's API, so we'll use a simpler approach
        // Just add the link assuming it exists
        const branchUrl = `${GITEA_SERVER_URL}/${owner}/${repo}/src/branch/${claudeBranch}`;
        branchLink = `\n[View branch](${branchUrl})`;
      }
    }

    // Check if we need to add PR URL when we have a new branch
    let prLink = "";
    // If claudeBranch is set, it means we created a new branch (for issues or closed/merged PRs)
    if (claudeBranch && !shouldDeleteBranch) {
      // Check if comment already contains a PR URL
      const serverUrlPattern = serverUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const prUrlPattern = new RegExp(
        `${serverUrlPattern}\\/.+\\/compare\\/${baseBranch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.\\.\\.`,
      );
      const containsPRUrl = currentBody.match(prUrlPattern);

      if (!containsPRUrl) {
        // Check if there are changes to the branch compared to the default branch
        try {
          // Gitea doesn't have a direct compareCommits API, so we'll check the branch status
          const branchRefUrl = `${GITEA_API_URL}/repos/${owner}/${repo}/git/commits?sha=${claudeBranch}&limit=1`;
          const branchRefResponse = await fetch(branchRefUrl, {
            headers: {
              Accept: "application/json",
              Authorization: `token ${giteaToken}`,
            },
          });

          if (branchRefResponse.ok) {
            const branchCommits = (await branchRefResponse.json()) as Array<{
              sha: string;
            }>;

            // If there's at least one commit, there are changes
            if (branchCommits.length > 0) {
              const entityType = context.isPR ? "PR" : "Issue";
              const prTitle = encodeURIComponent(
                `${entityType} #${context.entityNumber}: Changes from Claude`,
              );
              const prBody = encodeURIComponent(
                `This PR addresses ${entityType.toLowerCase()} #${context.entityNumber}\n\nGenerated with [Claude Code](https://claude.ai/code)`,
              );
              // Gitea's quick pull format
              const prUrl = `${GITEA_SERVER_URL}/${owner}/${repo}/compare/${baseBranch}...${claudeBranch}?quick_pull=1&title=${prTitle}&body=${prBody}`;
              prLink = `\n[Create a PR](${prUrl})`;
            }
          }
        } catch (error) {
          console.error("Error checking for changes in branch:", error);
          // Don't fail the entire update if we can't check for changes
        }
      }
    }

    // Check if action failed and read output file for execution details
    let executionDetails: {
      total_cost_usd?: number;
      duration_ms?: number;
      duration_api_ms?: number;
    } | null = null;
    let actionFailed = false;
    let errorDetails: string | undefined;

    // First check if prepare step failed
    const prepareSuccess = process.env.PREPARE_SUCCESS !== "false";
    const prepareError = process.env.PREPARE_ERROR;

    if (!prepareSuccess && prepareError) {
      actionFailed = true;
      errorDetails = prepareError;
    } else {
      // Check for existence of output file and parse it if available
      try {
        const outputFile = process.env.OUTPUT_FILE;
        if (outputFile) {
          const fileContent = await fs.readFile(outputFile, "utf8");
          const outputData = JSON.parse(fileContent);

          // Output file is an array, get the last element which contains execution details
          if (Array.isArray(outputData) && outputData.length > 0) {
            const lastElement = outputData[outputData.length - 1];
            if (
              lastElement.type === "result" &&
              "total_cost_usd" in lastElement &&
              "duration_ms" in lastElement
            ) {
              executionDetails = {
                total_cost_usd: lastElement.total_cost_usd,
                duration_ms: lastElement.duration_ms,
                duration_api_ms: lastElement.duration_api_ms,
              };
            }
          }
        }

        // Check if the Claude action failed
        const claudeSuccess = process.env.CLAUDE_SUCCESS !== "false";
        actionFailed = !claudeSuccess;
      } catch (error) {
        console.error("Error reading output file:", error);
        // If we can't read the file, check for any failure markers
        actionFailed = process.env.CLAUDE_SUCCESS === "false";
      }
    }

    // Prepare input for updateCommentBody function
    const commentInput: CommentUpdateInput = {
      currentBody,
      actionFailed,
      executionDetails,
      jobUrl,
      branchLink,
      prLink,
      branchName: shouldDeleteBranch || !branchLink ? undefined : claudeBranch,
      triggerUsername,
      errorDetails,
    };

    const updatedBody = updateCommentBody(commentInput);

    try {
      await updateClaudeComment({
        owner,
        repo,
        commentId,
        body: updatedBody,
        isPullRequestComment: isPRComment,
      });
      console.log(
        `✅ Updated ${isPRComment ? "PR" : "issue"} comment ${commentId} with job link`,
      );
    } catch (updateError) {
      console.error(
        `Failed to update ${isPRComment ? "PR" : "issue"} comment:`,
        updateError,
      );
      throw updateError;
    }

    process.exit(0);
  } catch (error) {
    console.error("Error updating comment with job link:", error);
    process.exit(1);
  }
}

run();
