import fs from "fs/promises";
import Logger from "./logger.js";
import { detailedLogger } from "./logger_instance.js";

const logSuccessfulBlockerImport = async ({ team, pivotalId, blocker }) => {
  try {
    // Use getTeamLogPath as a static method instead
    const filePath = Logger.getTeamLogPath(
      team.name,
      "successful_blocker_imports.csv",
    );

    // Check if file exists, if not create it with headers
    try {
      await fs.access(filePath);
    } catch {
      await fs.writeFile(filePath, "Date,Pivotal ID,Blocker\n");
    }

    const logEntry = `${new Date().toISOString()},${pivotalId},${blocker}\n`;
    await fs.appendFile(filePath, logEntry);

    detailedLogger.importantSuccess(
      `Successfully imported blocker ${blocker} for story ${pivotalId}.`,
    );
  } catch (error) {
    detailedLogger.importantError(
      `Failed to log successful blocker import for story ${pivotalId} and blocker ${blocker}:`,
      error,
    );
    process.exit(1);
  }
};

export default logSuccessfulBlockerImport;
