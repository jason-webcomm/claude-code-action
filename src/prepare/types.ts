import type { GiteaContext } from "../github/context";
import type { Mode } from "../modes/types";

export type PrepareResult = {
  commentId?: number;
  branchInfo: {
    baseBranch: string;
    claudeBranch?: string;
    currentBranch: string;
  };
  mcpConfig: string;
};

export type PrepareOptions = {
  context: GiteaContext;
  mode: Mode;
  giteaToken: string;
};
