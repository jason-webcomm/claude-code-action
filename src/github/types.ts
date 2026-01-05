// Types for Gitea REST API responses

export type GiteaAuthor = {
  login: string;
  full_name?: string;
  email?: string;
  avatar_url?: string;
};

export type GiteaComment = {
  id: number;
  html_url: string;
  body: string;
  user: GiteaAuthor;
  created_at: string;
  updated_at?: string;
};

export type GiteaInlineComment = GiteaComment & {
  path?: string;
  line?: number;
  commit_id?: string;
  diff_hunk?: string;
  position?: number;
};

export type GiteaCommit = {
  id: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  committer: {
    name: string;
    email: string;
    date: string;
  };
  timestamp: number;
};

export type GiteaFile = {
  filename: string;
  additions: number;
  deletions: number;
  status: string;
  changes: number;
  patch?: string;
};

export type GiteaPullRequest = {
  id: number;
  number: number;
  title: string;
  body: string;
  user: GiteaAuthor;
  base: {
    label: string;
    ref: string;
    sha: string;
    repo: {
      full_name: string;
      html_url: string;
    };
  };
  head: {
    label: string;
    ref: string;
    sha: string;
    repo: {
      full_name: string;
      html_url: string;
    };
  };
  html_url: string;
  diff_url: string;
  patch_url: string;
  created_at: string;
  updated_at: string;
  merged_at?: string;
  closed_at?: string;
  merged: boolean;
  state: string;
  additions: number;
  deletions: number;
  changed_files: number;
  commits: number;
  review_comments: number;
};

export type GiteaIssue = {
  id: number;
  number: number;
  title: string;
  body: string;
  user: GiteaAuthor;
  html_url: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  state: string;
  comments: number;
  labels?: Array<{
    id: number;
    name: string;
    color: string;
  }>;
  assignee?: GiteaAuthor;
};

export type GiteaUser = {
  id: number;
  login: string;
  full_name?: string;
  email?: string;
  avatar_url?: string;
};

export type GiteaRepository = {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  owner: GiteaUser;
  private: boolean;
  fork: boolean;
  created_at: string;
  updated_at: string;
};

export type GiteaWebhookPayload = {
  action: string;
  number?: number;
  pull_request?: GiteaPullRequest;
  issue?: GiteaIssue;
  comment?: GiteaComment;
  repository?: GiteaRepository;
  sender?: GiteaAuthor;
};

// Gitea Actions types
export type GiteaActionRun = {
  id: number;
  status: string;
  conclusion?: string;
  created_at: string;
  updated_at: string;
  run_number: number;
  run_attempt: number;
  event: string;
  head_branch: string;
  head_sha: string;
  head_commit?: GiteaCommit;
  workflow: string;
};

export type GiteaActionJob = {
  id: number;
  name: string;
  status: string;
  conclusion?: string;
  started_at: string;
  finished_at?: string;
  steps: Array<{
    name: string;
    status: string;
    conclusion?: string;
  }>;
};
// Backward compatibility type aliases for GitHub
export type GitHubFile = GiteaFile;
export type GitHubPullRequest = GiteaPullRequest;
export type GitHubIssue = GiteaIssue;
export type GitHubComment = GiteaComment;
export type GitHubUser = GiteaUser;
export type GitHubAuthor = GiteaAuthor;
export type GitHubRepository = GiteaRepository;
