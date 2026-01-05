import { expect, test, describe } from "bun:test";
import {
  formatContext,
  formatBody,
  formatComments,
  formatChangedFiles,
  formatChangedFilesWithSHA,
} from "../src/github/data/formatter";
import type {
  GiteaPullRequest,
  GiteaIssue,
  GiteaComment,
  GiteaFile,
} from "../src/github/types";
import type { GiteaFileWithSHA } from "../src/github/data/fetcher";

describe("formatContext", () => {
  test("formats PR context correctly", () => {
    const prData: GiteaPullRequest = {
      id: 1,
      number: 123,
      title: "Test PR",
      body: "PR body",
      user: { login: "test-user" },
      base: {
        label: "main",
        ref: "main",
        sha: "def456",
        repo: {
          full_name: "owner/repo",
          html_url: "https://gitea.example.com/owner/repo",
        },
      },
      head: {
        label: "feature/test",
        ref: "feature/test",
        sha: "abc123",
        repo: {
          full_name: "owner/repo",
          html_url: "https://gitea.example.com/owner/repo",
        },
      },
      html_url: "https://gitea.example.com/owner/repo/pulls/123",
      diff_url: "https://gitea.example.com/owner/repo/pulls/123.diff",
      patch_url: "https://gitea.example.com/owner/repo/pulls/123.patch",
      created_at: "2023-01-01T00:00:00Z",
      updated_at: "2023-01-01T00:00:00Z",
      merged_at: null,
      closed_at: null,
      merged: false,
      state: "open",
      additions: 50,
      deletions: 30,
      changed_files: 2,
      commits: 3,
      review_comments: 0,
    };

    const result = formatContext(prData, true);
    expect(result).toBe(
      `PR Title: Test PR
PR Author: test-user
PR Branch: feature/test -> main
PR State: open
PR Additions: 50
PR Deletions: 30
Total Commits: 3
Changed Files: 2 files`,
    );
  });

  test("formats Issue context correctly", () => {
    const issueData: GiteaIssue = {
      id: 1,
      number: 123,
      title: "Test Issue",
      body: "Issue body",
      user: { login: "test-user" },
      html_url: "https://gitea.example.com/owner/repo/issues/123",
      created_at: "2023-01-01T00:00:00Z",
      updated_at: "2023-01-01T00:00:00Z",
    };

    const result = formatContext(issueData, false);
    expect(result).toBe(
      `Issue Title: Test Issue
Issue Author: test-user
Issue State: undefined`,
    );
  });
});

describe("formatBody", () => {
  test("replaces image URLs with local paths", () => {
    const body = `Here is some text with an image: ![screenshot](https://github.com/user-attachments/assets/test-image.png)
    
And another one: ![another](https://github.com/user-attachments/assets/another-image.jpg)

Some more text.`;

    const imageUrlMap = new Map([
      [
        "https://github.com/user-attachments/assets/test-image.png",
        "/tmp/github-images/image-1234-0.png",
      ],
      [
        "https://github.com/user-attachments/assets/another-image.jpg",
        "/tmp/github-images/image-1234-1.jpg",
      ],
    ]);

    const result = formatBody(body, imageUrlMap);
    expect(result)
      .toBe(`Here is some text with an image: ![](/tmp/github-images/image-1234-0.png)
    
And another one: ![](/tmp/github-images/image-1234-1.jpg)

Some more text.`);
  });

  test("handles empty image map", () => {
    const body = "No images here";
    const imageUrlMap = new Map<string, string>();

    const result = formatBody(body, imageUrlMap);
    expect(result).toBe("No images here");
  });

  test("preserves body when no images match", () => {
    const body = "![image](https://example.com/image.png)";
    const imageUrlMap = new Map([
      [
        "https://github.com/user-attachments/assets/different.png",
        "/tmp/github-images/image-1234-0.png",
      ],
    ]);

    const result = formatBody(body, imageUrlMap);
    expect(result).toBe("![](https://example.com/image.png)");
  });

  test("handles multiple occurrences of same image", () => {
    const body = `First: ![img](https://github.com/user-attachments/assets/test.png)
Second: ![img](https://github.com/user-attachments/assets/test.png)`;

    const imageUrlMap = new Map([
      [
        "https://github.com/user-attachments/assets/test.png",
        "/tmp/github-images/image-1234-0.png",
      ],
    ]);

    const result = formatBody(body, imageUrlMap);
    expect(result).toBe(`First: ![](/tmp/github-images/image-1234-0.png)
Second: ![](/tmp/github-images/image-1234-0.png)`);
  });
});

describe("formatComments", () => {
  test("formats comments correctly", () => {
    const comments: GiteaComment[] = [
      {
        id: 1,
        html_url:
          "https://gitea.example.com/owner/repo/issues/123#issuecomment-1",
        body: "First comment",
        user: { login: "user1" },
        created_at: "2023-01-01T00:00:00Z",
      },
      {
        id: 2,
        html_url:
          "https://gitea.example.com/owner/repo/issues/123#issuecomment-2",
        body: "Second comment",
        user: { login: "user2" },
        created_at: "2023-01-02T00:00:00Z",
      },
    ];

    const result = formatComments(comments);
    expect(result).toBe(
      `[user1 at 2023-01-01T00:00:00Z]: First comment\n\n[user2 at 2023-01-02T00:00:00Z]: Second comment`,
    );
  });

  test("returns empty string for empty comments array", () => {
    const result = formatComments([]);
    expect(result).toBe("");
  });

  test("replaces image URLs in comments", () => {
    const comments: GiteaComment[] = [
      {
        id: 1,
        html_url:
          "https://gitea.example.com/owner/repo/issues/123#issuecomment-1",
        body: "Check out this screenshot: ![screenshot](https://github.com/user-attachments/assets/screenshot.png)",
        user: { login: "user1" },
        created_at: "2023-01-01T00:00:00Z",
      },
      {
        id: 2,
        html_url:
          "https://gitea.example.com/owner/repo/issues/123#issuecomment-2",
        body: "Here's another image: ![bug](https://github.com/user-attachments/assets/bug-report.jpg)",
        user: { login: "user2" },
        created_at: "2023-01-02T00:00:00Z",
      },
    ];

    const imageUrlMap = new Map([
      [
        "https://github.com/user-attachments/assets/screenshot.png",
        "/tmp/github-images/image-1234-0.png",
      ],
      [
        "https://github.com/user-attachments/assets/bug-report.jpg",
        "/tmp/github-images/image-1234-1.jpg",
      ],
    ]);

    const result = formatComments(comments, imageUrlMap);
    expect(result).toBe(
      `[user1 at 2023-01-01T00:00:00Z]: Check out this screenshot: ![](/tmp/github-images/image-1234-0.png)\n\n[user2 at 2023-01-02T00:00:00Z]: Here's another image: ![](/tmp/github-images/image-1234-1.jpg)`,
    );
  });

  test("handles comments with multiple images", () => {
    const comments: GiteaComment[] = [
      {
        id: 1,
        html_url:
          "https://gitea.example.com/owner/repo/issues/123#issuecomment-1",
        updated_at: "2023-01-01T00:00:00Z",
        body: "Two images: ![first](https://github.com/user-attachments/assets/first.png) and ![second](https://github.com/user-attachments/assets/second.png)",
        user: { login: "user1" },
        created_at: "2023-01-01T00:00:00Z",
      },
    ];

    const imageUrlMap = new Map([
      [
        "https://github.com/user-attachments/assets/first.png",
        "/tmp/github-images/image-1234-0.png",
      ],
      [
        "https://github.com/user-attachments/assets/second.png",
        "/tmp/github-images/image-1234-1.png",
      ],
    ]);

    const result = formatComments(comments, imageUrlMap);
    expect(result).toBe(
      `[user1 at 2023-01-01T00:00:00Z]: Two images: ![](/tmp/github-images/image-1234-0.png) and ![](/tmp/github-images/image-1234-1.png)`,
    );
  });

  test("preserves comments when imageUrlMap is undefined", () => {
    const comments: GiteaComment[] = [
      {
        id: 1,
        html_url:
          "https://gitea.example.com/owner/repo/issues/123#issuecomment-1",
        updated_at: "2023-01-01T00:00:00Z",
        body: "Image: ![test](https://github.com/user-attachments/assets/test.png)",
        user: { login: "user1" },
        created_at: "2023-01-01T00:00:00Z",
      },
    ];

    const result = formatComments(comments);
    expect(result).toBe(
      `[user1 at 2023-01-01T00:00:00Z]: Image: ![](https://github.com/user-attachments/assets/test.png)`,
    );
  });

  test("filters out comments without body", () => {
    const comments: GiteaComment[] = [
      {
        id: 1,
        html_url:
          "https://gitea.example.com/owner/repo/issues/123#issuecomment-1",
        updated_at: "2023-01-01T00:00:00Z",
        body: "Normal comment",
        user: { login: "user1" },
        created_at: "2023-01-01T00:00:00Z",
      },
      {
        id: 2,
        html_url:
          "https://gitea.example.com/owner/repo/issues/123#issuecomment-2",
        updated_at: "2023-01-02T00:00:00Z",
        body: "",
        user: { login: "user2" },
        created_at: "2023-01-02T00:00:00Z",
      },
      {
        id: 3,
        html_url:
          "https://gitea.example.com/owner/repo/issues/123#issuecomment-3",
        body: "Another normal comment",
        user: { login: "user3" },
        created_at: "2023-01-03T00:00:00Z",
      },
    ];

    const result = formatComments(comments);
    expect(result).toBe(
      `[user1 at 2023-01-01T00:00:00Z]: Normal comment\n\n[user3 at 2023-01-03T00:00:00Z]: Another normal comment`,
    );
  });

  test("returns empty string when all comments have no body", () => {
    const comments: GiteaComment[] = [
      {
        id: 1,
        html_url:
          "https://gitea.example.com/owner/repo/issues/123#issuecomment-1",
        updated_at: "2023-01-01T00:00:00Z",
        body: "",
        user: { login: "user1" },
        created_at: "2023-01-01T00:00:00Z",
      },
      {
        id: 2,
        html_url:
          "https://gitea.example.com/owner/repo/issues/123#issuecomment-2",
        updated_at: "2023-01-02T00:00:00Z",
        body: "",
        user: { login: "user2" },
        created_at: "2023-01-02T00:00:00Z",
      },
    ];

    const result = formatComments(comments);
    expect(result).toBe("");
  });
});

describe("formatChangedFiles", () => {
  test("formats changed files correctly", () => {
    const files: GiteaFile[] = [
      {
        filename: "src/index.ts",
        additions: 10,
        deletions: 5,
        status: "MODIFIED",
        changes: 15,
      },
      {
        filename: "src/utils.ts",
        additions: 20,
        deletions: 0,
        status: "ADDED",
        changes: 20,
      },
    ];

    const result = formatChangedFiles(files);
    expect(result).toBe(
      `- src/index.ts (MODIFIED) +10/-5\n- src/utils.ts (ADDED) +20/-0`,
    );
  });

  test("returns empty string for empty files array", () => {
    const result = formatChangedFiles([]);
    expect(result).toBe("");
  });
});

describe("formatChangedFilesWithSHA", () => {
  test("formats changed files with SHA correctly", () => {
    const files: GiteaFileWithSHA[] = [
      {
        filename: "src/index.ts",
        additions: 10,
        deletions: 5,
        status: "MODIFIED",
        changes: 15,
        sha: "abc123",
      },
      {
        filename: "src/utils.ts",
        additions: 20,
        deletions: 0,
        status: "ADDED",
        changes: 20,
        sha: "def456",
      },
    ];

    const result = formatChangedFilesWithSHA(files);
    expect(result).toBe(
      `- src/index.ts (MODIFIED) +10/-5 SHA: abc123\n- src/utils.ts (ADDED) +20/-0 SHA: def456`,
    );
  });

  test("returns empty string for empty files array", () => {
    const result = formatChangedFilesWithSHA([]);
    expect(result).toBe("");
  });
});
