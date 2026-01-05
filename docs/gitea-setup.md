# Gitea Setup Guide

This guide explains how to set up Claude Code Action for use with Gitea.

## Prerequisites

- A Gitea instance (self-hosted or Gitea Cloud)
- A Gitea repository where you want to use Claude Code Action
- Gitea Actions enabled on your instance

## Installation

### 1. Create a Personal Access Token

To use Claude Code Action with Gitea, you need to create a personal access token:

1. Navigate to your Gitea instance's user settings (e.g., `/user/settings/applications`)
2. Click "Generate New Token"
3. Fill in the token details:
   - **Token Name**: Claude Code Action
   - **Scope**: Enable `repo` permission
4. Save and copy the generated token

### 2. Configure Secrets

Add the following secrets to your Gitea repository or organization:

| Secret              | Description                                                   | Required                       |
| ------------------- | ------------------------------------------------------------- | ------------------------------ |
| `GITEA_TOKEN`       | A personal access token with `repo` scope                     | Yes                            |
| `ANTHROPIC_API_KEY` | Your Anthropic API key                                        | Yes                            |
| `GITEA_API_URL`     | Your Gitea API URL (e.g., `https://gitea.example.com/api/v1`) | No (defaults to Gitea Actions) |
| `GITEA_SERVER_URL`  | Your Gitea server URL (e.g., `https://gitea.example.com`)     | No (defaults to Gitea Actions) |

### 3. Create a Workflow

Create a workflow file in `.gitea/workflows/`:

```yaml
name: Claude Code

on:
  issue_comment:
    types: [created]
  issues:
    types: [opened, edited]
  pull_request:
    types: [opened, synchronize]

jobs:
  claude:
    runs-on: ubuntu-latest
    steps:
      - name: Claude Code
        uses: ./ # Path to this action
        with:
          prompt: "Review for bugs and security issues"
          trigger-phrase: "@claude"
          claude-version: "claude-sonnet-4-20250514"
```

## Configuration

### Input Parameters

| Input              | Description                            | Default                    |
| ------------------ | -------------------------------------- | -------------------------- |
| `prompt`           | The prompt to send to Claude           | (required)                 |
| `trigger-phrase`   | Phrase that triggers Claude            | `/claude`                  |
| `assignee-trigger` | Assignee username that triggers Claude |                            |
| `label-trigger`    | Label name that triggers Claude        |                            |
| `branch-prefix`    | Prefix for branches created by Claude  | `claude/`                  |
| `track-progress`   | Whether to track progress with tags    | `false`                    |
| `claude-version`   | Claude model version                   | `claude-sonnet-4-20250514` |
| `max-tokens`       | Maximum tokens for Claude response     | `8192`                     |

### Environment Variables

| Variable            | Description                          |
| ------------------- | ------------------------------------ |
| `GITEA_TOKEN`       | Personal access token for API access |
| `ANTHROPIC_API_KEY` | Anthropic API key                    |
| `GITEA_API_URL`     | Gitea API URL (optional)             |
| `GITEA_SERVER_URL`  | Gitea server URL (optional)          |

## Usage

### Triggering Claude

You can trigger Claude in several ways:

1. **Mention in issue/PR comment**: `@claude please help fix this bug`
2. **Mention in issue/PR body**: `/claude review this PR for security issues`
3. **Assign to specific user**: Assign the issue to a user specified in `assignee-trigger`
4. **Add specific label**: Add a label specified in `label-trigger`

### Example Workflow

```yaml
name: Claude Code Review

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5

      - name: Claude Code Review
        uses: ./ # Path to this action
        with:
          prompt: |
            Review this pull request for:
            - Security vulnerabilities
            - Performance issues
            - Code quality concerns
            - Best practices violations

            Please provide specific feedback and suggestions.
          trigger-phrase: "/claude review"
          claude-version: "claude-sonnet-4-20250514"
```

## Differences from GitHub Actions

While Claude Code Action for Gitea provides similar functionality to the GitHub Actions version, there are some differences:

### Event Types

Gitea uses different webhook event names:

- `issue_comment` (similar to GitHub)
- `issues` (similar to GitHub)
- `pull_request` (similar to GitHub)

**Note**: Gitea does not support:

- `pull_request_review` events
- `pull_request_review_comment` events

### API Access

Gitea uses REST API v1 instead of GitHub's GraphQL and REST APIs. Some advanced features may have different behaviors or limitations.

### Authentication

Gitea uses personal access tokens for API authentication. The action authenticates using the `GITEA_TOKEN` secret.

### Comment Location

When Claude responds to a pull request, the comment appears in the PR's **Conversation** tab (the main comments section). In Gitea, PRs are essentially a type of issue, so comments are posted to the issue/PR comment endpoint.

## Troubleshooting

### "Unauthorized" Errors

Ensure:

- Your `GITEA_TOKEN` has the correct permissions (repo scope)
- The token hasn't expired
- The token is correctly configured in your repository or organization secrets

### "Claude not responding"

Check:

- Your `ANTHROPIC_API_KEY` is valid
- You have available API credits
- The prompt isn't exceeding token limits

### Workflow Not Triggering

Verify:

- The workflow file is in `.gitea/workflows/`
- The event types match Gitea's webhook events
- Trigger phrase matches exactly (case-sensitive)

## Support

For issues specific to Gitea integration:

- Check the [Gitea Documentation](https://docs.gitea.io/)
- Review the [Migration Guide](./migration-from-github.md)
- Open an issue in the repository
