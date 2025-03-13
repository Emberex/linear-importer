import inquirer from "inquirer";
import { detailedLogger } from "../../logger/logger_instance.js";

async function importBlockers() {
  const { shouldImportBlockers } = await inquirer.prompt([
    {
      type: "list",
      name: "shouldImportBlockers",
      message: "Do you want to import blockers?",
      choices: [
        { name: "Yes", value: true },
        { name: "No", value: false },
      ],
      default: true,
    },
  ]);

  const { shouldOnlyImportBlockers } = await inquirer.prompt([
    {
      type: "list",
      name: "shouldOnlyImportBlockers",
      message: "Do you want to import anything else?",
      choices: [
        { name: "Yes", value: false },
        { name: "No", value: true },
      ],
      default: true,
    },
  ]);

  detailedLogger.info(`shouldOnlyImportBlockers: ${shouldOnlyImportBlockers}`);

  return { shouldImportBlockers, shouldOnlyImportBlockers };
}

export default importBlockers;
