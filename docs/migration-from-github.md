# Migration Guide: GitHub Actions to Gitea Actions

This guide helps you migrate from Claude Code Action for GitHub Actions to the Gitea Actions version.

## Overview

Claude Code Action provides a similar experience on both GitHub and Gitea. This guide highlights the key differences and steps for migration.

## Quick Migration Checklist

- [ ] Create Gitea OAuth2 application
- [ ] Configure Gitea secrets
- [ ] Update workflow files from `.github/workflows/` to `.gitea/workflows/`
- [ ] Update environment variable names
- [ ] Update action references
- [ ] Test migrated workflows

## Authentication Changes

### GitHub Actions

```yaml
# GitHub Actions uses GitHub Apps or OIDC
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  # Optional: Custom GitHub App
  APP_ID: ${{ secrets.APP_ID }}
  APP_PRIVATE_KEY: ${{ secrets.APP_PRIVATE_KEY }}
```

### Gitea Actions

```yaml
# Gitea Actions uses OAuth2
env:
  GITEA_TOKEN: ${{ secrets.GITEA_TOKEN }}
  GITEA_CLIENT_ID: ${{ secrets.GITEA_CLIENT_ID }}
  GITEA_CLIENT_SECRET: ${{ secrets.GITEA_CLIENT_SECRET }}
```

**Steps to migrate authentication:**

1. Create a Gitea OAuth2 application:

   - Go to your Gitea instance → Settings → Applications
   - Create new OAuth2 app
   - Save Client ID and Client Secret as repository secrets

2. Create a personal access token:
   - Go to your Gitea instance → Settings → Tokens
   - Create token with `repo` scope
   - Save as `GITEA_TOKEN` secret

## Workflow File Changes

### Location Change

```
.github/workflows/  →  .gitea/workflows/
```

### Event Name Changes

Most event names remain the same, but there are some differences:

| GitHub Actions                | Gitea Actions         | Notes                         |
| ----------------------------- | --------------------- | ----------------------------- |
| `issue_comment`               | `issue_comment`       | Same                          |
| `issues`                      | `issues`              | Same                          |
| `pull_request`                | `pull_request`        | Same                          |
| `pull_request_review`         | ❌ Not supported      | Gitea doesn't have this event |
| `pull_request_review_comment` | ❌ Not supported      | Gitea doesn't have this event |
| `workflow_dispatch`           | `workflow_dispatch`   | Same                          |
| `repository_dispatch`         | `repository_dispatch` | Same                          |

### Example Migration

#### GitHub Actions Workflow

```yaml
name: Claude Code

on:
  pull_request:
    types: [opened, synchronize]
  pull_request_review:
    types: [submitted]

jobs:
  claude:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: anthropic-ai/claude-code-action@v1
        with:
          prompt: "Review this PR"
          trigger-phrase: "@claude"
```

#### Gitea Actions Workflow

```yaml
name: Claude Code

on:
  pull_request:
    types: [opened, synchronize]
  # Note: pull_request_review not supported

jobs:
  claude:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: ./ # Local action reference
        with:
          prompt: "Review this PR"
          trigger-phrase: "@claude"
```

## Environment Variable Changes

| GitHub Actions      | Gitea Actions      |
| ------------------- | ------------------ |
| `GITHUB_TOKEN`      | `GITEA_TOKEN`      |
| `GITHUB_API_URL`    | `GITEA_API_URL`    |
| `GITHUB_SERVER_URL` | `GITEA_SERVER_URL` |
| `GITHUB_REPOSITORY` | `GITEA_REPOSITORY` |

## Feature Differences

### Not Supported in Gitea

1. **Pull Request Reviews**

   - GitHub: `pull_request_review` event
   - Gitea: ❌ Not supported
   - **Workaround**: Use `issue_comment` on PRs instead

2. **Pull Request Review Comments**

   - GitHub: `pull_request_review_comment` event
   - Gitea: ❌ Not supported
   - **Workaround**: Use inline comments via `issue_comment`

3. **OIDC Authentication**
   - GitHub: Supported via OIDC
   - Gitea: Uses OAuth2

### Behavioral Differences

1. **Commit Signing**

   - GitHub: Supports commit signing with GPG
   - Gitea: Uses SSH signing key

2. **Repository Dispatch**
   - GitHub: Uses `client_payload`
   - Gitea: Similar but may have payload format differences

## Configuration Migration

### Input Parameters

Most inputs remain the same, but verify:

| Input                | GitHub | Gitea | Notes           |
| -------------------- | ------ | ----- | --------------- |
| `prompt`             | ✓      | ✓     | Same            |
| `trigger-phrase`     | ✓      | ✓     | Same            |
| `assignee-trigger`   | ✓      | ✓     | Same            |
| `label-trigger`      | ✓      | ✓     | Same            |
| `branch-prefix`      | ✓      | ✓     | Same            |
| `track-progress`     | ✓      | ✓     | Same            |
| `use-sticky-comment` | ✓      | ✓     | Same            |
| `use-commit-signing` | ✓      | ✓     | Same (uses SSH) |
| `ssh-signing-key`    | ✓      | ✓     | Same            |
| `allowed-bots`       | ✓      | ✓     | Same            |
| `track-progress`     | ✓      | ✓     | Same            |

## Step-by-Step Migration

### 1. Backup Existing Workflows

```bash
# Backup your GitHub workflows
cp -r .github/workflows/ .github/workflows.backup/
```

### 2. Create Gitea Workflows Directory

```bash
mkdir -p .gitea/workflows
```

### 3. Copy and Update Workflows

For each workflow file:

```bash
# Copy from GitHub to Gitea
cp .github/workflows/your-workflow.yml .gitea/workflows/

# Update the file:
# 1. Remove pull_request_review events
# 2. Remove pull_request_review_comment events
# 3. Update GITHUB_* to GITEA_* variables
# 4. Update action reference if needed
```

### 4. Update Secrets

In your Gitea repository settings, add these secrets:

- `GITEA_TOKEN`
- `GITEA_CLIENT_ID`
- `GITEA_CLIENT_SECRET`
- `ANTHROPIC_API_KEY`

### 5. Test the Migration

1. Push changes to Gitea
2. Observe workflow runs
3. Verify Claude responds correctly
4. Check for any errors in workflow logs

## Common Migration Issues

### Issue: "Event not supported"

**Cause**: Using an event not available in Gitea

**Solution**: Replace with a supported event:

- `pull_request_review` → Use `issue_comment` on PR instead
- `pull_request_review_comment` → Use `issue_comment` on PR instead

### Issue: "Token authentication failed"

**Cause**: Using wrong token type or expired token

**Solution**:

- Ensure `GITEA_TOKEN` is a personal access token with `repo` scope
- Verify `GITEA_CLIENT_ID` and `GITEA_CLIENT_SECRET` are correct
- Check token hasn't expired

### Issue: "Claude not triggered"

**Cause**: Trigger phrase or event mismatch

**Solution**:

- Verify trigger phrase matches exactly (case-sensitive)
- Check event types are supported in Gitea
- Ensure issue/PR has the trigger in body or comment

### Issue: "Branch creation failed"

**Cause**: Permission issue or branch name conflict

**Solution**:

- Verify `GITEA_TOKEN` has write permissions
- Check for existing branch with same name
- Ensure branch prefix is valid

## Example: Complete Migration

### Before (GitHub Actions)

```yaml
# .github/workflows/claude.yml
name: Claude Code

on:
  pull_request:
    types: [opened, synchronize]
  pull_request_review:
    types: [submitted]
  issue_comment:
    types: [created]

env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

jobs:
  claude:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0

      - uses: anthropic-ai/claude-code-action@v1
        with:
          prompt: "Review this PR for security and quality"
          trigger-phrase: "@claude"
          claude-version: "claude-sonnet-4-20250514"
```

### After (Gitea Actions)

```yaml
# .gitea/workflows/claude.yml
name: Claude Code

on:
  pull_request:
    types: [opened, synchronize]
  # pull_request_review not supported - removed
  issue_comment:
    types: [created]

env:
  GITEA_TOKEN: ${{ secrets.GITEA_TOKEN }}
  GITEA_CLIENT_ID: ${{ secrets.GITEA_CLIENT_ID }}
  GITEA_CLIENT_SECRET: ${{ secrets.GITEA_CLIENT_SECRET }}

jobs:
  claude:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0

      - uses: ./ # Local action reference
        with:
          prompt: "Review this PR for security and quality"
          trigger-phrase: "@claude"
          claude-version: "claude-sonnet-4-20250514"
```

## Testing Checklist

After migration, verify:

- [ ] Workflows trigger on correct events
- [ ] Claude responds to trigger phrases
- [ ] Branches are created correctly
- [ ] Comments are posted correctly
- [ ] Progress tracking works (if enabled)
- [ ] No authentication errors
- [ ] No permission errors

## Rollback Plan

If migration has issues, you can:

1. Keep GitHub Actions workflow alongside Gitea for testing
2. Revert to GitHub Actions if needed
3. Use feature flags to gradually migrate

## Support

For additional help:

- Review [Gitea Setup Guide](./gitea-setup.md)
- Check [Gitea Documentation](https://docs.gitea.io/)
- Open an issue in the repository

## Additional Resources

- [Gitea Actions Documentation](https://docs.gitea.io/usage/actions/overview)
- [Gitea REST API](https://docs.gitea.io/en/api/)
- [Anthropic API Documentation](https://docs.anthropic.com/)
