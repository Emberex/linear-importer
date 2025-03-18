import inquirer from "inquirer";
import { detailedLogger } from "../../logger/logger_instance.js";

async function updateLabels() {
  const { shouldUpdateLabels } = await inquirer.prompt([
    {
      type: "list",
      name: "shouldUpdateLabels",
      message: "Do you want to update labels?",
      choices: [
        { name: "Yes", value: true },
        { name: "No", value: false },
      ],
      default: true,
    },
  ]);

  detailedLogger.info(`shouldUpdateLabels: ${shouldUpdateLabels}`);

  return shouldUpdateLabels;
}

export default updateLabels;
