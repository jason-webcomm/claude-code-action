import { GITEA_SERVER_URL } from "../../api/config";

export const SPINNER_HTML =
  '<img src="https://raw.githubusercontent.com/anthropics/claude-code-action/main/assets/spinner.gif" width="14px" height="14px" style="vertical-align: middle; margin-left: 4px;" />';

export function createJobRunLink(
  owner: string,
  repo: string,
  runId: string,
): string {
  // Gitea Actions URL format
  const jobRunUrl = `${GITEA_SERVER_URL}/${owner}/${repo}/actions/runs/${runId}`;
  return `[View job run](${jobRunUrl})`;
}

export function createBranchLink(
  owner: string,
  repo: string,
  branchName: string,
): string {
  const branchUrl = `${GITEA_SERVER_URL}/${owner}/${repo}/src/branch/${branchName}`;
  return `\n[View branch](${branchUrl})`;
}

export function createCommentBody(
  jobRunLink: string,
  branchLink: string = "",
): string {
  return `Claude Code is working… ${SPINNER_HTML}

I'll analyze this and get back to you.

${jobRunLink}${branchLink}`;
}
