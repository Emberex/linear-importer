import fs from "fs/promises";
import Logger from "./logger.js";

import { detailedLogger } from "./logger_instance.js";

const readSuccessfulImports = async (teamName) => {
  if (!teamName) {
    detailedLogger.warning("No team name provided to readSuccessfulImports");
    process.exit(0);
  }

  try {
    const filePath = Logger.getTeamLogPath(teamName, "successful_imports.csv");

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      detailedLogger.warning(
        `No imported stories log found for team "${teamName}"`,
      );
      return new Set();
    }

    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split("\n").slice(1); // Skip header row

    const successfulImports = new Set(
      lines
        .filter((line) => line.trim()) // Remove empty lines
        .map((line) => {
          const [, id] = line.split(",");
          return id?.trim(); // Ensure ID is trimmed
        })
        .filter(Boolean), // Remove any undefined/null/empty values
    );

    detailedLogger.result(
      `Found ${successfulImports.size} previously imported stories for team "${teamName}"`,
    );

    return successfulImports;
  } catch (error) {
    detailedLogger.error(
      `Error reading successful imports for team "${teamName}":`,
      error,
    );
    process.exit(0);
  }
};

export default readSuccessfulImports;
