import fs from "fs/promises";
import Logger from "./logger.js";
import { detailedLogger } from "./logger_instance.js";

const readSuccessfulBlockerImports = async (teamName) => {
  if (!teamName) {
    detailedLogger.warning(
      "No team name provided to readSuccessfulBlockerImports",
    );
    process.exit(0);
  }

  try {
    const filePath = Logger.getTeamLogPath(
      teamName,
      "successful_blocker_imports.csv",
    );

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      detailedLogger.warning(
        `No imported blocker log found for team "${teamName}"`,
      );
      return new Set();
    }

    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split("\n").slice(1); // Skip header row

    const successfulBlockerImports = new Set(
      lines
        .filter((line) => line.trim()) // Remove empty lines
        .reduce((acc, line) => {
          const [, id, blocker] = line.split(",").map((item) => item.trim());
          if (id && blocker) {
            acc.push([id, blocker]);
          }
          return acc;
        }, []),
    );

    detailedLogger.result(
      `Found ${successfulBlockerImports.size} previously imported blocker for team "${teamName}"`,
    );

    return successfulBlockerImports;
  } catch (error) {
    detailedLogger.error(
      `Error reading successful blocker imports for team "${teamName}":`,
      error,
    );
    process.exit(0);
  }
};

export default readSuccessfulBlockerImports;
