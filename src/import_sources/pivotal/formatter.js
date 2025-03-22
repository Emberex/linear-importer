import { detailedLogger } from "../../../logger/logger_instance.js";
import readSuccessfulImports from "../../../logger/read_successful_imports.js";

import parseCSV from "../../csv/parse.js";
import selectStatusTypes from "./select_status_types.js";

import buildImportSummary from "./build_import_summary.js";

async function formatter({ team, directory }) {
  detailedLogger.importantLoading(`Setting up Pivotal Import...`);

  // Prompt user to select status types
  const selectedStatusTypes = await selectStatusTypes();

  // Parse CSV
  const csvData = await parseCSV(directory);

  // Read previously imported stories from `successful_imports.csv`
  const successfulImports = await readSuccessfulImports(team.name);

  // Remove empty blockers.
  const formattedIssuePayload = csvData.issues.map(
    ({ blockers, blockerStatuses, ...issue }) => {
      if (blockers.length !== blockerStatuses.length) {
        detailedLogger.error(
          `Found a different number of blockers and blocker statuses for story ${issue.id}. Exiting...`,
        );
        process.exit(1);
      }

      const reducedBlockers = [];
      const reducedBlockerStatuses = [];
      for (var i = 0; i < blockers.length; ++i) {
        const blocker = blockers[i];
        if (!blocker.trim()) {
          continue;
        }
        reducedBlockers.push(blocker);
        reducedBlockerStatuses.push(blockerStatuses[i]);
      }
      return {
        ...issue,
        blockers: reducedBlockers,
        blockerStatuses: reducedBlockerStatuses,
      };
    },
  );

  // Filter out stories that have already been imported and logged in `successful_imports.csv`
  // TODO: move this out of pivotal formatter and make it a global function. probably need to create a dir for each import source to allow for different log files per import source
  const pivotalStoriesThatHaveNotBeenImported = csvData.issues.filter(
    (story) => !successfulImports.has(story.id),
  );

  // Only include stories that match the selected status types in `selectedStatusTypes`
  const filteredFormattedIssuePayload =
    pivotalStoriesThatHaveNotBeenImported.filter((story) =>
      selectedStatusTypes.includes(story.state),
    );

  // TODO: Make this shorter... maybe return a sample object or set to a different logging level
  detailedLogger.info(
    `Formatted Issue Payload: ${JSON.stringify(
      formattedIssuePayload,
      null,
      2,
    )}`,
  );

  // Build import summary
  const confirmationMessage = buildImportSummary({
    formattedIssuePayload: filteredFormattedIssuePayload,
    successfulImports,
  });

  return {
    csvData,
    formattedIssuePayload,
    filteredFormattedIssuePayload,
    confirmationMessage,
  };
}

export default formatter;

// if (newReleaseStories.length + newPivotalStories.length === 0) {
//   console.log(chalk.bold.green("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
//   console.log(chalk.bold.green("✨ All stories already imported! ✨"));
//   console.log(chalk.bold.green("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));
//   process.exit(0);
// }

// detailedLogger.info(`🔸 Starting import for team ${team.name}`);
// detailedLogger.loading(`Import Source: ${meta.importSource}`);
// console.log("--------------------------------");
// detailedLogger.warning(`Team: ${JSON.stringify(team, null, 2)}`);
// detailedLogger.success(`Options: ${JSON.stringify(options, null, 2)}`);
// detailedLogger.info(`Meta: ${JSON.stringify(meta, null, 2)}`);
// console.log("--------------------------------");
// detailedLogger.importantSuccess(`Processing ${meta.importSource} stories...`);

// console.log("\nImport Status:");
//   console.log("Successful imports from CSV:", successfulImports.size);
//   console.log(
//     "Sample of successful imports:",
//     Array.from(successfulImports).slice(0, 5),
//   );
//   console.log("\nPivotal Stories:");
//   console.log("Total stories from Pivotal (raw):", pivotalStories.length);
//   console.log(
//     "Total unique stories from Pivotal:",
//     uniquePivotalStories.length,
//   );
//   console.log(
//     "Sample of unique Pivotal story IDs:",
//     uniquePivotalStories.slice(0, 5).map((story) => story.id),
//   );
