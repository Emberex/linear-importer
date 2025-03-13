import linearClient from "../../config/client.mjs";
import { detailedLogger } from "../../logger/logger_instance.js";
import { REQUEST_DELAY_MS } from "../../config/config.js";
import createComment from "../comments/create.js";
import fetchIssuesForTeam from "../issues/list.mjs";
import fetchRelations from "./list.mjs";
import getUserMapping from "../users/get_user_mapping.js";
import { linkLinearUsernames } from "../users/link_linear_usernames.js";
import {
  PIVOTAL_ID_REGEX,
  LINEAR_COMMENT_PIVOTAL_ID_PREFIX,
  LINEAR_COMMENT_PIVOTAL_ID_REGEX,
} from "../constants/regex.js";

async function createBlockers({ pivotalIssues, team }) {
  const userMapping = await getUserMapping(team.name);

  const existingRelations = await fetchRelations();
  const linearIssues = await fetchIssuesForTeam({ teamId: team.id });

  const pivotalIdToLinearId = linearIssues.reduce((acc, issue) => {
    const pivotalId = issue.description
      ?.match(LINEAR_COMMENT_PIVOTAL_ID_REGEX)?.[0]
      ?.replace(LINEAR_COMMENT_PIVOTAL_ID_PREFIX, "");

    if (pivotalId) {
      acc[pivotalId] = issue.id;
    } else {
      detailedLogger.importantWarning(
        `No pivotal id was found for linear issue ${issue.id}`,
      );
    }
    return acc;
  }, {});

  for (const issue of pivotalIssues) {
    if (issue.blockers.length === 0) {
      detailedLogger.importantInfo(`No blockers found for story ${issue.id}.`);
      continue;
    }
    if (issue.blockers.length !== issue.blockerStatuses.length) {
      detailedLogger.importantError(
        `Found a different number of blockers and blocker statuses for story ${issue.id}.`,
      );
      continue;
    }

    for (var i = 0; i < issue.blockers.length; i++) {
      const blocker = issue.blockers[i];
      const blockerStatus = issue.blockerStatuses[i];
      const linearIssueId = pivotalIdToLinearId[issue.id];

      if (!blocker.trim()) {
        detailedLogger.importantInfo(
          `Skipping blank blocker for story ${issue.id}`,
        );
        continue;
      }

      if (!linearIssueId) {
        detailedLogger.importantError(
          `Failed to find a Linear issue for story ${issue.id}. Blocker ${blocker} skipped.`,
        );
        continue;
      }

      detailedLogger.importantInfo(
        `Creating blocker ${blocker} for story ${issue.id}`,
      );

      if (PIVOTAL_ID_REGEX.test(blocker)) {
        const blockingIssueId = pivotalIdToLinearId[blocker.replace("#", "")];

        if (!blockingIssueId) {
          detailedLogger.importantError(
            `Failed to find the issue blocking story ${issue.id}. Blocker ${blocker} skipped.`,
          );
          continue;
        }

        // Technically, createIssueRelation won't create duplicate relations, so this could
        // be removed if we don't care that it will still log a success message.
        if (
          existingRelations?.some(
            (relation) =>
              relation._issue.id === blockingIssueId &&
              relation._relatedIssue.id === linearIssueId,
          )
        ) {
          detailedLogger.importantInfo(
            `Issue ${blockingIssueId} is already blocking ${linearIssueId}. Skipping`,
          );
          continue;
        }
        try {
          await linearClient.createIssueRelation({
            issueId: blockingIssueId,
            relatedIssueId: linearIssueId,
            type: blockerStatus === "resolved" ? "related" : "blocks",
          });
        } catch (error) {
          detailedLogger.importantError(
            `Failed to create the blocker ${blocker} for story ${issue.id}: ${error.message}`,
          );
          continue;
        }
      } else {
        // Since Linear blockers are relations between two issues, we can't create people / text
        // blockers like you can with Pivotal. Instead, this creates comments on the blocked issue
        // with the same information.
        const issueBody = `Blocker: ${await linkLinearUsernames(blocker, userMapping)}${blockerStatus === "resolved" ? " - resolved" : ""}`;
        const existingComments = await linearClient.comments({
          filter: { issue: { id: { eq: linearIssueId } } },
        });
        // Unlike actual blockers, there's nothing stopping createComment
        // from creating duplicate comments, so this check is necessary.
        if (existingComments.nodes.some(({ body }) => body === issueBody)) {
          detailedLogger.importantInfo(
            `Blocker ${blocker} already exists for story ${issue.id}. Skipping.`,
          );
          continue;
        }

        try {
          await createComment({
            issueId: linearIssueId,
            body: issueBody,
          });
        } catch (error) {
          detailedLogger.importantError(
            `Failed to create the blocker ${blocker} for story ${issue.id}: ${error.message}`,
          );
          continue;
        }
      }

      detailedLogger.importantSuccess(
        `Successfully imported blocker ${blocker} for story ${issue.id}.`,
      );
      await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
    }
  }
}

export default createBlockers;
