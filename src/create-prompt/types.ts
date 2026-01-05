import type { GiteaContext } from "../github/context";

export type CommonFields = {
  repository: string;
  claudeCommentId: string;
  triggerPhrase: string;
  triggerUsername?: string;
  prompt?: string;
  claudeBranch?: string;
};

type IssueCommentEvent = {
  eventName: "issue_comment";
  commentId: string;
  isPR: boolean;
  prNumber?: string;
  issueNumber?: string;
  commentBody: string;
  claudeBranch?: string;
  baseBranch?: string;
};

type IssueOpenedEvent = {
  eventName: "issues";
  eventAction: "opened";
  isPR: false;
  issueNumber: string;
  baseBranch: string;
  claudeBranch: string;
};

type IssueAssignedEvent = {
  eventName: "issues";
  eventAction: "assigned";
  isPR: false;
  issueNumber: string;
  baseBranch: string;
  claudeBranch: string;
  assigneeTrigger?: string;
};

type IssueLabeledEvent = {
  eventName: "issues";
  eventAction: "labeled";
  isPR: false;
  issueNumber: string;
  baseBranch: string;
  claudeBranch: string;
  labelTrigger: string;
};

type PullRequestBaseEvent = {
  eventAction?: string; // opened, synchronize, etc.
  isPR: true;
  prNumber: string;
  claudeBranch?: string;
  baseBranch?: string;
};

type PullRequestEvent = PullRequestBaseEvent & {
  eventName: "pull_request";
};

type PullRequestTargetEvent = PullRequestBaseEvent & {
  eventName: "pull_request_target";
};

// Union type for all possible event types
export type EventData =
  | IssueCommentEvent
  | IssueOpenedEvent
  | IssueAssignedEvent
  | IssueLabeledEvent
  | PullRequestEvent
  | PullRequestTargetEvent;

// Combined type with separate eventData field
export type PreparedContext = CommonFields & {
  eventData: EventData;
  giteaContext?: GiteaContext;
};
