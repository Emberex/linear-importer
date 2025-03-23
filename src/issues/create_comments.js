import createComment from "../comments/create.js";
import { REQUEST_DELAY_MS } from "../../config/config.js";
import { detailedLogger } from "../../logger/logger_instance.js";
import { linkLinearUsernames } from "../users/link_linear_usernames.js";

async function createComments({ issue, newIssue, userMapping }) {
  detailedLogger.loading(`Finding comments for story ${issue.id}`);

  if (issue.comments.length === 0) {
    detailedLogger.info(`No comments found for story ${issue.id}.`);
    return;
  }

  // Create comments
  for (const body of issue.comments) {
    await createComment({
      issueId: newIssue._issue.id,
      body: linkLinearUsernames({ text: body, userMapping }),
    });

    await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
  }
}

export default createComments;
