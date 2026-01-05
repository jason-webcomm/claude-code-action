import { GITEA_API_URL } from "../../api/config";

export type UpdateClaudeCommentParams = {
  owner: string;
  repo: string;
  commentId: number;
  body: string;
  isPullRequestComment: boolean;
};

export type UpdateClaudeCommentResult = {
  id: number;
  html_url: string;
  updated_at: string;
};

/**
 * Updates a Claude comment on Gitea (either an issue/PR comment or a PR review comment)
 *
 * Gitea uses the same API endpoint for both issue and PR comments.
 * PR review comments are a separate concept in GitHub but Gitea handles them differently.
 *
 * @param params - Parameters for updating the comment
 * @returns The updated comment details
 * @throws Error if the update fails
 */
export async function updateClaudeComment(
  params: UpdateClaudeCommentParams,
): Promise<UpdateClaudeCommentResult> {
  const { owner, repo, commentId, body, isPullRequestComment } = params;

  // Gitea uses the same endpoint for both issue and PR comments
  // POST /repos/{owner}/{repo}/issues/comments/{id} for updates
  const commentUrl = `${GITEA_API_URL}/repos/${owner}/${repo}/issues/comments/${commentId}`;

  const response = await fetch(commentUrl, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `token ${process.env.GITEA_TOKEN}`,
    },
    body: JSON.stringify({
      body,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to update comment: ${response.status} - ${errorText}`,
    );
  }

  const data = (await response.json()) as {
    id: number;
    html_url: string;
    updated_at: string;
  };

  return {
    id: data.id,
    html_url: data.html_url,
    updated_at: data.updated_at,
  };
}
