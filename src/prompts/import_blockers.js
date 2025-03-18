import inquirer from "inquirer";

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
  return shouldImportBlockers;
}

export default importBlockers;
