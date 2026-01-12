import { GITEA_API_URL, GITEA_TOKEN } from "../api/config";
import type { GiteaContext } from "../context";
import { GITEA_PERMISSION_LEVELS } from "../constants";

/**
 * Check if the actor has write permissions to the repository
 * @param context - The Gitea context
 * @param allowedNonWriteUsers - Comma-separated list of users allowed without write permissions, or '*' for all
 * @param giteaTokenProvided - Whether gitea_token was provided as input (not from app)
 * @returns true if the actor has write permissions, false otherwise
 */
export async function checkWritePermissions(
  context: GiteaContext,
  allowedNonWriteUsers?: string,
  giteaTokenProvided?: boolean,
): Promise<boolean> {
  const { repository, actor } = context;

  try {
    console.log(`Checking permissions for actor: ${actor}`);

    // Check if we should bypass permission checks for this user
    if (allowedNonWriteUsers && giteaTokenProvided) {
      const allowedUsers = allowedNonWriteUsers.trim();
      if (allowedUsers === "*") {
        console.warn(
          `⚠️ SECURITY WARNING: Bypassing write permission check for ${actor} due to allowed_non_write_users='*'. This should only be used for workflows with very limited permissions.`,
        );
        return true;
      } else if (allowedUsers) {
        const allowedUserList = allowedUsers
          .split(",")
          .map((u) => u.trim())
          .filter((u) => u.length > 0);
        if (allowedUserList.includes(actor)) {
          console.warn(
            `⚠️ SECURITY WARNING: Bypassing write permission check for ${actor} due to allowed_non_write_users configuration. This should only be used for workflows with very limited permissions.`,
          );
          return true;
        }
      }
    }

    // Check if the actor is a bot (Gitea bots typically have specific patterns)
    if (actor.endsWith("[bot]") || actor.startsWith("bot-")) {
      console.log(`Actor is a bot: ${actor}`);
      return true;
    }

    // Step 1: Check using the collaborators endpoint
    // This endpoint correctly checks the actor's permissions including team-based access
    const response = await fetch(
      `${GITEA_API_URL}/repos/${repository.owner}/${repository.repo}/collaborators/${actor}/permission`,
      {
        headers: {
          Authorization: `token ${GITEA_TOKEN}`,
          Accept: "application/json",
        },
      },
    );

    if (response.ok) {
      const data = (await response.json()) as {
        permission: string;
        user: {
          login: string;
        };
      };

      console.log(
        `Permission level retrieved (collaborator): ${data.permission}`,
      );
      console.log(`Full collaborator response:`, JSON.stringify(data));

      const permissionLevel = data.permission;

      // If collaborator endpoint returns a valid write permission, we're done
      if (
        permissionLevel === GITEA_PERMISSION_LEVELS.OWNER ||
        permissionLevel === GITEA_PERMISSION_LEVELS.ADMIN ||
        permissionLevel === GITEA_PERMISSION_LEVELS.WRITE
      ) {
        console.log(`Actor has write access: ${permissionLevel}`);
        return true;
      }

      // If permission is "none", we need to check team membership
      if (permissionLevel === "none") {
        console.log(
          `Collaborator endpoint returned 'none', checking team membership...`,
        );
      } else {
        // User has read or no access
        console.warn(`Actor has insufficient permissions: ${permissionLevel}`);
        return false;
      }
    } else if (response.status === 403 || response.status === 404) {
      // User doesn't have access, check team membership
      console.log(
        `User not a direct collaborator (status ${response.status}), checking team membership...`,
      );
    } else {
      throw new Error(
        `Failed to check permissions: ${response.status} ${response.statusText}`,
      );
    }

    // Step 2: Check team membership by querying teams with access to this repo
    // and checking if the actor is a member of any team with write permission
    try {
      const teamsResponse = await fetch(
        `${GITEA_API_URL}/repos/${repository.owner}/${repository.repo}/teams`,
        {
          headers: {
            Authorization: `token ${GITEA_TOKEN}`,
            Accept: "application/json",
          },
        },
      );

      if (!teamsResponse.ok) {
        console.log(
          `Failed to fetch teams (status ${teamsResponse.status}). User may not have access.`,
        );
        return false;
      }

      const teams = (await teamsResponse.json()) as Array<{
        id: number;
        name: string;
        permission: string;
        units: string[];
      }>;

      console.log(`Found ${teams.length} teams with access to this repo`);

      // Check if actor is a member of any team with write permission
      for (const team of teams) {
        // Check if team has write or admin permission
        if (
          team.permission === "write" ||
          team.permission === "admin" ||
          team.permission === "owner"
        ) {
          console.log(
            `Checking if actor ${actor} is a member of team ${team.name} (permission: ${team.permission})...`,
          );

          // Check if actor is a member of this team by fetching all members
          // /teams/{id}/members/{username} returns 403 if token doesn't have permission
          // so we use /teams/{id}/members and check the list instead
          const membersResponse = await fetch(
            `${GITEA_API_URL}/teams/${team.id}/members`,
            {
              headers: {
                Authorization: `token ${GITEA_TOKEN}`,
                Accept: "application/json",
              },
            },
          );

          if (!membersResponse.ok) {
            console.log(
              `Failed to fetch members for team ${team.name}: ${membersResponse.status} ${membersResponse.statusText}`,
            );
            continue;
          }

          const members = (await membersResponse.json()) as Array<{
            id: number;
            login: string;
            username: string;
          }>;

          const isMember = members.some(
            (m) => m.login === actor || m.username === actor,
          );

          if (isMember) {
            console.log(
              `Actor ${actor} is a member of team ${team.name} with ${team.permission} permission`,
            );
            return true;
          }
        }
      }

      // Actor is not a member of any team with write permission
      console.warn(
        `Actor ${actor} is not a member of any team with write permission`,
      );
      return false;
    } catch (error) {
      console.error(`Error checking team membership: ${error}`);
      return false;
    }
  } catch (error) {
    console.error(`Failed to check permissions: ${error}`);
    throw new Error(`Failed to check permissions for ${actor}: ${error}`);
  }
}
