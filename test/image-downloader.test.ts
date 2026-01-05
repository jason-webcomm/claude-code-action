import {
  describe,
  test,
  expect,
  spyOn,
  beforeEach,
  afterEach,
  jest,
  setSystemTime,
} from "bun:test";
import fs from "fs/promises";
import { downloadCommentImages } from "../src/github/utils/image-downloader";
import type { CommentWithImages } from "../src/github/utils/image-downloader";

describe("downloadCommentImages", () => {
  let consoleLogSpy: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;
  let fsMkdirSpy: any;
  let fsWriteFileSpy: any;
  let fetchSpy: any;

  beforeEach(() => {
    // Spy on console methods
    consoleLogSpy = spyOn(console, "log").mockImplementation(() => {});
    consoleWarnSpy = spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});

    // Spy on fs methods
    fsMkdirSpy = spyOn(fs, "mkdir").mockResolvedValue(undefined);
    fsWriteFileSpy = spyOn(fs, "writeFile").mockResolvedValue(undefined);

    // Set fake system time for consistent filenames
    setSystemTime(new Date("2024-01-01T00:00:00.000Z")); // 1704067200000
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    fsMkdirSpy.mockRestore();
    fsWriteFileSpy.mockRestore();
    if (fetchSpy) fetchSpy.mockRestore();
    setSystemTime(); // Reset to real time
  });

  test("should create download directory", async () => {
    const comments: CommentWithImages[] = [];

    await downloadCommentImages("owner", "repo", comments);

    expect(fsMkdirSpy).toHaveBeenCalledWith("/tmp/gitea-images", {
      recursive: true,
    });
  });

  test("should handle comments without images", async () => {
    const comments: CommentWithImages[] = [
      {
        type: "issue_comment",
        id: "123",
        body: "This is a comment without images",
      },
    ];

    const result = await downloadCommentImages("owner", "repo", comments);

    expect(result.size).toBe(0);
    expect(consoleLogSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("Found"),
    );
  });

  test("should detect and download images from issue comments", async () => {
    const giteaServerUrl = "https://your-gitea-instance";
    const imageUrl = `${giteaServerUrl}/attachments/test-image.png`;

    // Mock fetch for Gitea API (comment body) and image download
    fetchSpy = spyOn(global, "fetch").mockImplementation((url: string) => {
      if (url.includes("/repos/owner/repo/issues/comments/123")) {
        // Gitea API response for comment
        return Promise.resolve({
          ok: true,
          json: async () => ({ body: "Comment body" }),
        } as Response);
      }
      if (url.includes(imageUrl)) {
        // Image download response
        return Promise.resolve({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(8),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      } as Response);
    });

    const comments: CommentWithImages[] = [
      {
        type: "issue_comment",
        id: "123",
        body: `Here's an image: ![test](${imageUrl})`,
      },
    ];

    const result = await downloadCommentImages("owner", "repo", comments);

    expect(result.size).toBe(1);
    expect(result.get(imageUrl)).toBe(
      "/tmp/gitea-images/image-1704067200000-0.png",
    );
  });

  test("should handle issue bodies", async () => {
    const giteaServerUrl = "https://your-gitea-instance";
    const imageUrl = `${giteaServerUrl}/attachments/issue-body.gif`;

    // Mock fetch for Gitea API (issue body) and image download
    fetchSpy = spyOn(global, "fetch").mockImplementation((url: string) => {
      if (url.includes("/repos/owner/repo/issues/200")) {
        // Gitea API response for issue
        return Promise.resolve({
          ok: true,
          json: async () => ({ body: "Issue body" }),
        } as Response);
      }
      if (url.includes(imageUrl)) {
        // Image download response
        return Promise.resolve({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(8),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      } as Response);
    });

    const comments: CommentWithImages[] = [
      {
        type: "issue_body",
        issueNumber: "200",
        body: `Issue description: ![issue](${imageUrl})`,
      },
    ];

    const result = await downloadCommentImages("owner", "repo", comments);

    expect(result.size).toBe(1);
    expect(result.get(imageUrl)).toBe(
      "/tmp/gitea-images/image-1704067200000-0.gif",
    );
  });

  test("should handle PR bodies", async () => {
    const giteaServerUrl = "https://your-gitea-instance";
    const imageUrl = `${giteaServerUrl}/attachments/pr-body.webp`;

    // Mock fetch for Gitea API (PR body) and image download
    fetchSpy = spyOn(global, "fetch").mockImplementation((url: string) => {
      if (url.includes("/repos/owner/repo/pulls/300")) {
        // Gitea API response for PR
        return Promise.resolve({
          ok: true,
          json: async () => ({ body: "PR body" }),
        } as Response);
      }
      if (url.includes(imageUrl)) {
        // Image download response
        return Promise.resolve({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(8),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      } as Response);
    });

    const comments: CommentWithImages[] = [
      {
        type: "pr_body",
        pullNumber: "300",
        body: `PR description: ![pr](${imageUrl})`,
      },
    ];

    const result = await downloadCommentImages("owner", "repo", comments);

    expect(result.size).toBe(1);
    expect(result.get(imageUrl)).toBe(
      "/tmp/gitea-images/image-1704067200000-0.webp",
    );
  });

  test("should skip already downloaded images", async () => {
    const giteaServerUrl = "https://your-gitea-instance";
    const imageUrl = `${giteaServerUrl}/attachments/duplicate.png`;

    let fetchCallCount = 0;
    fetchSpy = spyOn(global, "fetch").mockImplementation((url: string) => {
      if (url.includes("/repos/owner/repo/issues/comments/")) {
        fetchCallCount++;
        return Promise.resolve({
          ok: true,
          json: async () => ({ body: "Comment body" }),
        } as Response);
      }
      if (url.includes(imageUrl)) {
        fetchCallCount++;
        return Promise.resolve({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(8),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      } as Response);
    });

    const comments: CommentWithImages[] = [
      {
        type: "issue_comment",
        id: "111",
        body: `First: ![dup](${imageUrl})`,
      },
      {
        type: "issue_comment",
        id: "222",
        body: `Second: ![dup](${imageUrl})`,
      },
    ];

    const result = await downloadCommentImages("owner", "repo", comments);

    expect(fetchCallCount).toBe(3); // 2 API calls (one per comment) + 1 image download
    expect(result.size).toBe(1);
    expect(result.get(imageUrl)).toBe(
      "/tmp/gitea-images/image-1704067200000-0.png",
    );
  });

  test("should handle fetch errors", async () => {
    const giteaServerUrl = "https://your-gitea-instance";
    const imageUrl = `${giteaServerUrl}/attachments/error.png`;

    fetchSpy = spyOn(global, "fetch").mockImplementation((url: string) => {
      if (url.includes("/repos/owner/repo/issues/comments/")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ body: "Comment body" }),
        } as Response);
      }
      if (url.includes(imageUrl)) {
        return Promise.resolve({
          ok: false,
          status: 404,
          statusText: "Not Found",
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      } as Response);
    });

    const comments: CommentWithImages[] = [
      {
        type: "issue_comment",
        id: "444",
        body: `Error image: ![error](${imageUrl})`,
      },
    ];

    const result = await downloadCommentImages("owner", "repo", comments);

    expect(result.size).toBe(0);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `✗ Failed to download ${imageUrl}:`,
      expect.any(Error),
    );
  });

  test("should handle API errors gracefully", async () => {
    const giteaServerUrl = "https://your-gitea-instance";
    const imageUrl = `${giteaServerUrl}/attachments/api-error.png`;

    fetchSpy = spyOn(global, "fetch").mockImplementation((url: string) => {
      if (url.includes("/repos/owner/repo/issues/comments/")) {
        return Promise.reject(new Error("API rate limit exceeded"));
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      } as Response);
    });

    const comments: CommentWithImages[] = [
      {
        type: "issue_comment",
        id: "555",
        body: `API error: ![api-error](${imageUrl})`,
      },
    ];

    const result = await downloadCommentImages("owner", "repo", comments);

    expect(result.size).toBe(0);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to process images for issue_comment 555:",
      expect.any(Error),
    );
  });

  test("should extract correct file extensions", async () => {
    const extensions = [
      { url: "https://your-gitea-instance/attachments/test.png", ext: ".png" },
      { url: "https://your-gitea-instance/attachments/test.jpg", ext: ".jpg" },
      {
        url: "https://your-gitea-instance/attachments/test.jpeg",
        ext: ".jpeg",
      },
      { url: "https://your-gitea-instance/attachments/test.gif", ext: ".gif" },
      {
        url: "https://your-gitea-instance/attachments/test.webp",
        ext: ".webp",
      },
      { url: "https://your-gitea-instance/attachments/test.svg", ext: ".svg" },
      // default
      {
        url: "https://your-gitea-instance/attachments/no-extension",
        ext: ".png",
      },
    ];

    let callIndex = 0;
    fetchSpy = spyOn(global, "fetch").mockImplementation((url: string) => {
      if (url.includes("/repos/owner/repo/")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ body: "Body" }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
      } as Response);
    });

    for (const { url, ext } of extensions) {
      const comments: CommentWithImages[] = [
        {
          type: "issue_comment",
          id: `${1000 + callIndex}`,
          body: `Test: ![test](${url})`,
        },
      ];

      setSystemTime(new Date(1704067200000 + callIndex));
      const result = await downloadCommentImages("owner", "repo", comments);
      expect(result.get(url)).toBe(
        `/tmp/gitea-images/image-${1704067200000 + callIndex}-0${ext}`,
      );

      // Reset for next iteration
      fsWriteFileSpy.mockClear();
      callIndex++;
    }
  });

  test("should handle multiple images in a single comment", async () => {
    const giteaServerUrl = "https://your-gitea-instance";
    const imageUrl1 = `${giteaServerUrl}/attachments/image1.png`;
    const imageUrl2 = `${giteaServerUrl}/attachments/image2.jpg`;

    fetchSpy = spyOn(global, "fetch").mockImplementation((url: string) => {
      if (url.includes("/repos/owner/repo/issues/comments/")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ body: "Comment body" }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
      } as Response);
    });

    const comments: CommentWithImages[] = [
      {
        type: "issue_comment",
        id: "999",
        body: `Two images: ![img1](${imageUrl1}) and ![img2](${imageUrl2})`,
      },
    ];

    const result = await downloadCommentImages("owner", "repo", comments);

    expect(result.size).toBe(2);
    expect(result.get(imageUrl1)).toBe(
      "/tmp/gitea-images/image-1704067200000-0.png",
    );
    expect(result.get(imageUrl2)).toBe(
      "/tmp/gitea-images/image-1704067200000-1.jpg",
    );
  });
});
