import { describe, test, expect, jest, beforeEach } from "bun:test";

// Mock GITEA_API_URL
jest.mock("../src/github/api/config", () => ({
  GITEA_API_URL: "https://api.example.com/v1",
}));

// Mock fetch
global.fetch = jest.fn();

import {
  updateClaudeComment,
  type UpdateClaudeCommentParams,
} from "../src/github/operations/comments/update-claude-comment";

describe("updateClaudeComment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should update issue comment successfully", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        id: 123456,
        html_url: "https://example.com/owner/repo/issues/1#issuecomment-123456",
        updated_at: "2024-01-01T00:00:00Z",
      }),
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const params: UpdateClaudeCommentParams = {
      owner: "testowner",
      repo: "testrepo",
      commentId: 123456,
      body: "Updated comment",
      isPullRequestComment: false,
    };

    const result = await updateClaudeComment(params);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.example.com/v1/repos/testowner/testrepo/issues/comments/123456",
      {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: "token undefined",
        },
        body: JSON.stringify({
          body: "Updated comment",
        }),
      },
    );

    expect(result).toEqual({
      id: 123456,
      html_url: "https://example.com/owner/repo/issues/1#issuecomment-123456",
      updated_at: "2024-01-01T00:00:00Z",
    });
  });

  test("should update PR comment successfully", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        id: 789012,
        html_url: "https://example.com/owner/repo/pull/2#issuecomment-789012",
        updated_at: "2024-01-02T00:00:00Z",
      }),
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const params: UpdateClaudeCommentParams = {
      owner: "testowner",
      repo: "testrepo",
      commentId: 789012,
      body: "Updated PR comment",
      isPullRequestComment: true,
    };

    const result = await updateClaudeComment(params);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.example.com/v1/repos/testowner/testrepo/issues/comments/789012",
      {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: "token undefined",
        },
        body: JSON.stringify({
          body: "Updated PR comment",
        }),
      },
    );

    expect(result).toEqual({
      id: 789012,
      html_url: "https://example.com/owner/repo/pull/2#issuecomment-789012",
      updated_at: "2024-01-02T00:00:00Z",
    });
  });

  test("should propagate error when update fails", async () => {
    const mockResponse = {
      ok: false,
      status: 404,
      text: async () => "Not Found",
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const params: UpdateClaudeCommentParams = {
      owner: "testowner",
      repo: "testrepo",
      commentId: 999999,
      body: "This will fail",
      isPullRequestComment: false,
    };

    await expect(updateClaudeComment(params)).rejects.toThrow(
      "Failed to update comment: 404 - Not Found",
    );
  });

  test("should handle empty body", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        id: 111222,
        html_url: "https://example.com/owner/repo/issues/5#issuecomment-111222",
        updated_at: "2024-01-05T00:00:00Z",
        body: "",
      }),
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const params: UpdateClaudeCommentParams = {
      owner: "testowner",
      repo: "testrepo",
      commentId: 111222,
      body: "",
      isPullRequestComment: false,
    };

    const result = await updateClaudeComment(params);

    expect(result).toEqual({
      id: 111222,
      html_url: "https://example.com/owner/repo/issues/5#issuecomment-111222",
      updated_at: "2024-01-05T00:00:00Z",
    });
  });

  test("should handle very long body", async () => {
    const longBody = "x".repeat(10000);
    const mockResponse = {
      ok: true,
      json: async () => ({
        id: 333444,
        html_url: "https://example.com/owner/repo/issues/6#issuecomment-333444",
        updated_at: "2024-01-06T00:00:00Z",
        body: longBody,
      }),
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const params: UpdateClaudeCommentParams = {
      owner: "testowner",
      repo: "testrepo",
      commentId: 333444,
      body: longBody,
      isPullRequestComment: false,
    };

    const result = await updateClaudeComment(params);

    expect(result).toEqual({
      id: 333444,
      html_url: "https://example.com/owner/repo/issues/6#issuecomment-333444",
      updated_at: "2024-01-06T00:00:00Z",
    });
  });

  test("should handle markdown formatting in body", async () => {
    const markdownBody = `
# Header
- List item 1
- List item 2

\`\`\`typescript
const code = "example";
\`\`\`

[Link](https://example.com)
    `.trim();

    const mockResponse = {
      ok: true,
      json: async () => ({
        id: 555666,
        html_url: "https://example.com/owner/repo/issues/7#issuecomment-555666",
        updated_at: "2024-01-07T00:00:00Z",
        body: markdownBody,
      }),
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const params: UpdateClaudeCommentParams = {
      owner: "testowner",
      repo: "testrepo",
      commentId: 555666,
      body: markdownBody,
      isPullRequestComment: false,
    };

    const result = await updateClaudeComment(params);

    expect(result).toEqual({
      id: 555666,
      html_url: "https://example.com/owner/repo/issues/7#issuecomment-555666",
      updated_at: "2024-01-07T00:00:00Z",
    });
  });

  test("should handle different response data fields", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        id: 777888,
        html_url: "https://example.com/owner/repo/pull/8#issuecomment-777888",
        updated_at: "2024-01-08T12:30:45Z",
        body: "Updated",
        // Additional fields that might be in the response
        created_at: "2024-01-01T00:00:00Z",
        user: { login: "bot" },
      }),
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const params: UpdateClaudeCommentParams = {
      owner: "testowner",
      repo: "testrepo",
      commentId: 777888,
      body: "Updated",
      isPullRequestComment: true,
    };

    const result = await updateClaudeComment(params);

    // Should only return the specific fields we care about
    expect(result).toEqual({
      id: 777888,
      html_url: "https://example.com/owner/repo/pull/8#issuecomment-777888",
      updated_at: "2024-01-08T12:30:45Z",
    });
  });
});
