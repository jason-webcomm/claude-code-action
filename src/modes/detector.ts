import type { GiteaContext } from "../github/context";
import {
  isEntityContext,
  isIssueCommentEvent,
  isPullRequestEvent,
  isIssuesEvent,
} from "../github/context";
import { checkContainsTrigger } from "../github/validation/trigger";

export type AutoDetectedMode = "tag" | "agent";

export function detectMode(
  context: GiteaContext,
): AutoDetectedMode | undefined {
  console.log(
    `detectMode: eventName=${context.eventName}, entityNumber=${context.entityNumber}, isPR=${context.isPR}`,
  );

  // Validate track_progress usage
  if (context.inputs.trackProgress) {
    validateTrackProgressEvent(context);
  }

  // If track_progress is set for PR/issue events, force tag mode
  if (context.inputs.trackProgress && isEntityContext(context)) {
    if (
      isPullRequestEvent(context) ||
      isIssuesEvent(context) ||
      isIssueCommentEvent(context)
    ) {
      return "tag";
    }
  }

  // Comment events (current behavior - unchanged)
  console.log(
    `isEntityContext=${isEntityContext(context)}, isIssueCommentEvent=${isIssueCommentEvent(context)}`,
  );
  if (isEntityContext(context)) {
    if (isIssueCommentEvent(context)) {
      console.log(`Processing issue comment event`);
      console.log(`Prompt input: "${context.inputs.prompt}"`);
      console.log(`Trigger phrase: "${context.inputs.triggerPhrase}"`);
      // If prompt is provided on comment events, use agent mode
      if (context.inputs.prompt) {
        console.log(`Prompt provided, using agent mode`);
        return "agent";
      }
      // Default to tag mode if @claude mention found
      console.log(`Checking for trigger in comment...`);
      if (checkContainsTrigger(context)) {
        console.log(`Trigger found, using tag mode`);
        return "tag";
      }
    }
  }

  // Issue events
  if (isEntityContext(context) && isIssuesEvent(context)) {
    // If prompt is provided, use agent mode (same as PR events)
    if (context.inputs.prompt) {
      return "agent";
    }
    // Check for @claude mentions or labels/assignees
    if (checkContainsTrigger(context)) {
      return "tag";
    }
  }

  // PR events (opened, synchronize, etc.)
  if (isEntityContext(context) && isPullRequestEvent(context)) {
    const supportedActions = [
      "opened",
      "synchronize",
      "ready_for_review",
      "reopened",
    ];
    if (context.eventAction && supportedActions.includes(context.eventAction)) {
      // If prompt is provided, use agent mode (default for automation)
      if (context.inputs.prompt) {
        return "agent";
      }
    }
  }

  // No trigger found - return undefined to signal that action should not run
  return undefined;
}

export function getModeDescription(mode: AutoDetectedMode): string {
  switch (mode) {
    case "tag":
      return "Interactive mode triggered by @claude mentions";
    case "agent":
      return "Direct automation mode for explicit prompts";
    default:
      return "Unknown mode";
  }
}

function validateTrackProgressEvent(context: GiteaContext): void {
  // track_progress is only valid for pull_request and issue events
  const validEvents = ["pull_request", "issues", "issue_comment"];
  if (!validEvents.includes(context.eventName)) {
    throw new Error(
      `track_progress is only supported for events: ${validEvents.join(", ")}. ` +
        `Current event: ${context.eventName}`,
    );
  }

  // Additionally validate PR actions
  if (context.eventName === "pull_request" && context.eventAction) {
    const validActions = [
      "opened",
      "synchronize",
      "ready_for_review",
      "reopened",
    ];
    if (!validActions.includes(context.eventAction)) {
      throw new Error(
        `track_progress for pull_request events is only supported for actions: ` +
          `${validActions.join(", ")}. Current action: ${context.eventAction}`,
      );
    }
  }
}

export function shouldUseTrackingComment(mode: AutoDetectedMode): boolean {
  return mode === "tag";
}

export function getDefaultPromptForMode(
  mode: AutoDetectedMode,
  context: GiteaContext,
): string | undefined {
  switch (mode) {
    case "tag":
      return undefined;
    case "agent":
      return context.inputs?.prompt;
    default:
      return undefined;
  }
}
