import type {
  GiteaPullRequest,
  GiteaIssue,
  GiteaComment,
  GiteaFile,
} from "../types";
import type { GiteaFileWithSHA } from "./fetcher";
import { sanitizeContent } from "../utils/sanitizer";

export function formatContext(
  contextData: GiteaPullRequest | GiteaIssue,
  isPR: boolean,
): string {
  if (isPR) {
    const prData = contextData as GiteaPullRequest;
    return `PR Title: ${prData.title}
PR Author: ${prData.user.login}
PR Branch: ${prData.head.label} -> ${prData.base.label}
PR State: ${prData.state}
PR Additions: ${prData.additions}
PR Deletions: ${prData.deletions}
Total Commits: ${prData.commits}
Changed Files: ${prData.changed_files} files`;
  } else {
    const issueData = contextData as GiteaIssue;
    return `Issue Title: ${issueData.title}
Issue Author: ${issueData.user.login}
Issue State: ${issueData.state}`;
  }
}

export function formatBody(
  body: string,
  imageUrlMap: Map<string, string>,
): string {
  let processedBody = body;

  for (const [originalUrl, localPath] of imageUrlMap) {
    processedBody = processedBody.replaceAll(originalUrl, localPath);
  }

  processedBody = sanitizeContent(processedBody);

  return processedBody;
}

export function formatComments(
  comments: GiteaComment[],
  imageUrlMap?: Map<string, string>,
): string {
  return comments
    .filter((comment) => comment.body)
    .map((comment) => {
      let body = comment.body;

      if (imageUrlMap && body) {
        for (const [originalUrl, localPath] of imageUrlMap) {
          body = body.replaceAll(originalUrl, localPath);
        }
      }

      body = sanitizeContent(body);

      return `[${comment.user.login} at ${comment.created_at}]: ${body}`;
    })
    .join("\n\n");
}

export function formatChangedFiles(changedFiles: GiteaFile[]): string {
  return changedFiles
    .map(
      (file) =>
        `- ${file.filename} (${file.status}) +${file.additions}/-${file.deletions}`,
    )
    .join("\n");
}

export function formatChangedFilesWithSHA(
  changedFiles: GiteaFileWithSHA[],
): string {
  return changedFiles
    .map(
      (file) =>
        `- ${file.filename} (${file.status}) +${file.additions}/-${file.deletions} SHA: ${file.sha}`,
    )
    .join("\n");
}
