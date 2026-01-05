import fs from "fs/promises";
import path from "path";
import { GITEA_API_URL, GITEA_SERVER_URL } from "../api/config";

const escapedUrl = GITEA_SERVER_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const IMAGE_REGEX = new RegExp(
  `!\\[[^\\]]*\\]\\((${escapedUrl}\\/attachments\\/[^)]+)\\)`,
  "g",
);

const HTML_IMG_REGEX = new RegExp(
  `<img[^>]+src=["']([^"']*${escapedUrl}\\/attachments\\/[^"']+)["'][^>]*>`,
  "gi",
);

type IssueComment = {
  type: "issue_comment";
  id: string;
  body: string;
};

type IssueBody = {
  type: "issue_body";
  issueNumber: string;
  body: string;
};

type PullRequestBody = {
  type: "pr_body";
  pullNumber: string;
  body: string;
};

export type CommentWithImages = IssueComment | IssueBody | PullRequestBody;

export async function downloadCommentImages(
  owner: string,
  repo: string,
  comments: CommentWithImages[],
): Promise<Map<string, string>> {
  const urlToPathMap = new Map<string, string>();
  const downloadsDir = "/tmp/gitea-images";

  await fs.mkdir(downloadsDir, { recursive: true });

  const commentsWithImages: Array<{
    comment: CommentWithImages;
    urls: string[];
  }> = [];

  for (const comment of comments) {
    // Extract URLs from Markdown format
    const markdownMatches = [...comment.body.matchAll(IMAGE_REGEX)];
    const markdownUrls = markdownMatches.map((match) => match[1] as string);

    // Extract URLs from HTML format
    const htmlMatches = [...comment.body.matchAll(HTML_IMG_REGEX)];
    const htmlUrls = htmlMatches.map((match) => match[1] as string);

    // Combine and deduplicate URLs
    const urls = [...new Set([...markdownUrls, ...htmlUrls])];

    if (urls.length > 0) {
      commentsWithImages.push({ comment, urls });
      const id =
        comment.type === "issue_body"
          ? comment.issueNumber
          : comment.type === "pr_body"
            ? comment.pullNumber
            : comment.id;
      console.log(`Found ${urls.length} image(s) in ${comment.type} ${id}`);
    }
  }

  // Process each comment with images
  for (const { comment, urls } of commentsWithImages) {
    try {
      let bodyHtml: string | undefined;

      // Get the HTML version based on comment type using Gitea API
      switch (comment.type) {
        case "issue_comment": {
          const response = await fetch(
            `${GITEA_API_URL}/repos/${owner}/${repo}/issues/comments/${comment.id}`,
            {
              headers: {
                Accept: "application/json",
                Authorization: `token ${process.env.GITEA_TOKEN}`,
              },
            },
          );
          if (!response.ok) {
            throw new Error(
              `Failed to fetch comment: ${response.status} - ${await response.text()}`,
            );
          }
          const data = (await response.json()) as { body: string };
          // Gitea may not provide HTML directly, so we'll use the markdown body
          // If Gitea provides body_html in the future, use that instead
          bodyHtml = data.body;
          break;
        }
        case "issue_body": {
          const response = await fetch(
            `${GITEA_API_URL}/repos/${owner}/${repo}/issues/${comment.issueNumber}`,
            {
              headers: {
                Accept: "application/json",
                Authorization: `token ${process.env.GITEA_TOKEN}`,
              },
            },
          );
          if (!response.ok) {
            throw new Error(
              `Failed to fetch issue: ${response.status} - ${await response.text()}`,
            );
          }
          const data = (await response.json()) as { body: string };
          bodyHtml = data.body;
          break;
        }
        case "pr_body": {
          const response = await fetch(
            `${GITEA_API_URL}/repos/${owner}/${repo}/pulls/${comment.pullNumber}`,
            {
              headers: {
                Accept: "application/json",
                Authorization: `token ${process.env.GITEA_TOKEN}`,
              },
            },
          );
          if (!response.ok) {
            throw new Error(
              `Failed to fetch PR: ${response.status} - ${await response.text()}`,
            );
          }
          const data = (await response.json()) as { body: string };
          bodyHtml = data.body;
          break;
        }
      }
      if (!bodyHtml) {
        const id =
          comment.type === "issue_body"
            ? comment.issueNumber
            : comment.type === "pr_body"
              ? comment.pullNumber
              : comment.id;
        console.warn(`No HTML body found for ${comment.type} ${id}`);
        continue;
      }

      // For Gitea, we'll try to download directly from the attachment URLs
      // Gitea attachments are typically publicly accessible or require token auth
      // Download each image
      for (let i = 0; i < urls.length; i++) {
        const imageUrl = urls[i];

        // Check if we've already downloaded this URL
        if (urlToPathMap.has(imageUrl)) {
          continue;
        }

        const fileExtension = getImageExtension(imageUrl);
        const filename = `image-${Date.now()}-${i}${fileExtension}`;
        const localPath = path.join(downloadsDir, filename);

        try {
          console.log(`Downloading ${imageUrl}...`);

          const imageResponse = await fetch(imageUrl, {
            headers: {
              Authorization: `token ${process.env.GITEA_TOKEN}`,
            },
          });
          if (!imageResponse.ok) {
            throw new Error(
              `HTTP ${imageResponse.status}: ${imageResponse.statusText}`,
            );
          }

          const arrayBuffer = await imageResponse.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          await fs.writeFile(localPath, buffer);
          console.log(`✓ Saved: ${localPath}`);

          urlToPathMap.set(imageUrl, localPath);
        } catch (error) {
          console.error(`✗ Failed to download ${imageUrl}:`, error);
        }
      }
    } catch (error) {
      const id =
        comment.type === "issue_body"
          ? comment.issueNumber
          : comment.type === "pr_body"
            ? comment.pullNumber
            : comment.id;
      console.error(
        `Failed to process images for ${comment.type} ${id}:`,
        error,
      );
    }
  }

  return urlToPathMap;
}

function getImageExtension(url: string): string {
  const urlParts = url.split("/");
  const filename = urlParts[urlParts.length - 1];
  if (!filename) {
    throw new Error("Invalid URL: No filename found");
  }

  const match = filename.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i);
  return match ? match[0] : ".png";
}
