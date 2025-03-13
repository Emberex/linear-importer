import chalk from "chalk";
import getTeamMembers from "../teams/members.mjs";
import fs from "fs/promises";
import path from "path";
import inquirer from "inquirer";
import { detailedLogger } from "../../logger/logger_instance.js";
import { USERNAME_REGEX } from "../constants/regex.js";

export function extractUsernames(extractedPivotalData) {
  const usernames = new Set(
    extractedPivotalData.csvData.aggregatedData.userNames,
  );

  // Add @mentions from pivotal blockers.
  extractedPivotalData.formattedIssuePayload.forEach((issue) => {
    issue.blockers.forEach((blocker) =>
      (blocker.match(USERNAME_REGEX) || []).forEach((name) =>
        usernames.add(name),
      ),
    );
  });

  // Add @mentions from pivotal blockers.
  extractedPivotalData.formattedIssuePayload.forEach((issue) =>
    (issue.description.match(USERNAME_REGEX) || []).forEach((name) =>
      usernames.add(name),
    ),
  );

  // Add @mentions from comments.
  extractedPivotalData.formattedIssuePayload.forEach((issue) => {
    issue.comments.forEach((comment) =>
      (comment.match(USERNAME_REGEX) || []).forEach((name) =>
        usernames.add(name),
      ),
    );
  });

  return Array.from(usernames);
}

/**
 * Creates a mapping file that links external usernames to Linear users
 *
 * @param {Object} params
 * @param {Object} params.team - The Linear team object
 * @param {string} params.team.name - Used to generate the mapping file name (e.g., "team-name-user-mapping.json")
 * @param {string[]} params.extractedUsernames - Array of usernames found in the CSV import file
 *
 * This step:
 * 1. Creates/updates a JSON mapping file in the format:
 *    {
 *      "external_username": {
 *        linearId: string | null,
 *        linearName: string | null,
 *        linearEmail: string | null,
 *        note?: string  // Only present for unmatched users
 *      }
 *    }
 * 2. Prompts for Linear username matches if they don't exist
 * 3. Saves the mapping for use during issue creation
 */
async function createUserMapping({ team, extractedPivotalData }) {
  const extractedUsernames = extractUsernames(extractedPivotalData);

  if (extractedUsernames.length === 0) {
    detailedLogger.error("No extracted usernames found. Skipping...");
    process.exit(0);
  }

  detailedLogger.result(
    `Extracted usernames:\n${extractedUsernames.join("\n")}`,
  );
  detailedLogger.importantLoading(
    `Finding best matches for extracted usernames`,
  );

  // Fetch Team Members
  const { teamMembers } = await getTeamMembers({ teamId: team.id });

  // Check for existing mapping file
  const logDir = path.join(process.cwd(), "log", team.name);
  const mappingPath = path.join(logDir, "user_mapping.json");
  let existingMapping = {};
  let shouldRemap = false;
  let isNewMapping = false;

  try {
    const mappingFile = await fs.readFile(mappingPath, "utf8");
    const mappingData = JSON.parse(mappingFile);
    existingMapping = mappingData.mapping || {};

    detailedLogger.info(`Found existing user mapping file at: ${mappingPath}`);

    const { confirmRemap } = await inquirer.prompt([
      {
        type: "list",
        name: "confirmRemap",
        message:
          "Users have already been mapped for this team. Would you like to start fresh and remap all users?",
        choices: [
          { name: "Yes", value: true },
          { name: "No", value: false },
        ],
        default: false,
      },
    ]);

    shouldRemap = confirmRemap;
    isNewMapping = shouldRemap;
    if (!shouldRemap) {
      detailedLogger.loading("Continuing with existing user mapping");
    }
  } catch (error) {
    detailedLogger.loading(
      "No existing user mapping file found. Starting with empty mapping...",
    );
    isNewMapping = true;
  }

  const userMapping = shouldRemap ? {} : { ...existingMapping };
  let hasNewMappings = false;

  // Process all users with manual confirmation
  for (const pivotalUser of extractedUsernames) {
    if (!shouldRemap && userMapping[pivotalUser]) {
      continue;
    }

    hasNewMappings = true;
    const suggestedMatch = await findBestUserMatch(
      pivotalUser,
      teamMembers.nodes,
    );

    // Show the suggested match and ask for confirmation
    if (suggestedMatch) {
      console.log(
        chalk.yellow(`\nSuggested match for ${chalk.green(pivotalUser)}:`),
      );
      console.log(
        chalk.cyan(
          `${suggestedMatch.linearMember.name} (${suggestedMatch.linearMember.email})`,
        ),
      );
      console.log(
        chalk.gray(
          `Match confidence: ${Math.round(suggestedMatch.score * 100)}%\n`,
        ),
      );
    }

    const { confirmMatch } = await inquirer.prompt([
      {
        type: "list",
        name: "confirmMatch",
        message: `How would you like to handle mapping for ${chalk.green(pivotalUser)}?`,
        choices: [
          ...(suggestedMatch
            ? [
                {
                  name: "Accept suggested match",
                  value: "accept",
                },
              ]
            : []),
          {
            name: "Choose different user",
            value: "manual",
          },
          {
            name: "Skip this user",
            value: "skip",
          },
        ],
      },
    ]);

    let selectedMember;
    if (confirmMatch === "accept") {
      selectedMember = suggestedMatch.linearMember;
    } else if (confirmMatch === "manual") {
      selectedMember = await promptForManualMatch(
        pivotalUser,
        teamMembers.nodes,
      );
    }

    userMapping[pivotalUser] = selectedMember
      ? {
          linearId: selectedMember.id,
          linearName: selectedMember.name,
          linearEmail: selectedMember.email,
        }
      : {
          linearId: null,
          linearName: null,
          linearEmail: null,
          note: "No matching Linear user found (manual skip)",
        };
  }

  // Save mapping if it's new, was remapped, or has new additions
  if (isNewMapping || hasNewMappings) {
    await fs.mkdir(logDir, { recursive: true });
    await fs.writeFile(
      mappingPath,
      JSON.stringify(
        {
          generated: new Date().toISOString(),
          mapping: userMapping,
        },
        null,
        2,
      ),
    );
    detailedLogger.importantInfo(
      `New user mapping saved: ${JSON.stringify(userMapping, null, 2)}`,
    );

    detailedLogger.result(`User mapping saved to ${mappingPath}`);
  }

  console.log("\n" + chalk.cyan("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
  console.log(chalk.bold.cyan(`  📊 User mapping summary`));
  console.log(chalk.cyan("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));
  console.log(
    Object.entries(userMapping)
      .map(
        ([username, details]) =>
          `   ${chalk.green(username)} → ${chalk.cyan(details.linearName)} (${chalk.dim.cyan(details.linearEmail)})`,
      )
      .join("\n"),
  );

  detailedLogger.importantSuccess("✅ Setup complete!");
  return userMapping;
}

async function findBestUserMatch(pivotalName, linearMembers) {
  // Convert pivotal name to lowercase and clean it
  const normalizedPivotalName = pivotalName.toLowerCase().trim();
  const pivotalParts = normalizedPivotalName.split(/[\s_-]+/);

  let bestMatch = {
    linearMember: null,
    score: 0,
  };

  for (const member of linearMembers) {
    let totalScore = 0;
    let maxPossibleScore = 0;

    // Parse member's full name into parts
    const memberNameParts = member.name
      .toLowerCase()
      .trim()
      .split(/[\s_-]+/);

    // Add special handling for name parts matching
    for (const pivotalPart of pivotalParts) {
      for (const memberPart of memberNameParts) {
        const isLastPart =
          pivotalPart === pivotalParts[pivotalParts.length - 1];
        const weight = isLastPart ? 1.2 : 0.8;
        maxPossibleScore += weight;

        if (
          memberPart.includes(pivotalPart) ||
          pivotalPart.includes(memberPart)
        ) {
          totalScore += 0.9 * weight;
        }

        const similarityScore =
          calculateSimilarity(pivotalPart, memberPart) * weight;
        totalScore += similarityScore;
      }
    }

    // Normalize the score to be between 0 and 1
    const normalizedScore =
      maxPossibleScore > 0 ? totalScore / maxPossibleScore : 0;

    if (normalizedScore > bestMatch.score) {
      bestMatch = {
        linearMember: member,
        score: normalizedScore,
      };
    }
  }

  return bestMatch.score > 0.4 ? bestMatch : null;
}

// Helper function to check for common name variations
// function areNameVariations(name1, name2) {
//   const variations = {
//     alex: ["alexander", "aleksander", "oleksandr", "aleksandr"],
//     mike: ["michael", "mikhail"],
//     bob: ["robert"],
//     bill: ["william"],
//     dave: ["david"],
//     dan: ["daniel"],
//     nick: ["nicholas", "nicolas", "nico"],
//     chris: ["christopher"],
//     tony: ["anthony"],
//     jim: ["james"],
//     joe: ["joseph"],
//     steve: ["steven", "stephen"],
//   };

//   name1 = name1.toLowerCase();
//   name2 = name2.toLowerCase();

//   // Check direct variations
//   for (const [base, vars] of Object.entries(variations)) {
//     if (
//       (name1 === base && vars.includes(name2)) ||
//       (name2 === base && vars.includes(name1)) ||
//       (vars.includes(name1) && vars.includes(name2))
//     ) {
//       return true;
//     }
//   }

//   return false;
// }

function calculateSimilarity(str1, str2) {
  // Simple Levenshtein distance-based similarity
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);
  return 1 - distance / maxLength;
}

function levenshteinDistance(str1, str2) {
  const matrix = Array(str2.length + 1)
    .fill()
    .map(() => Array(str1.length + 1).fill(0));

  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j - 1][i] + 1,
        matrix[j][i - 1] + 1,
        matrix[j - 1][i - 1] + cost,
      );
    }
  }

  return matrix[str2.length][str1.length];
}

async function promptForManualMatch(pivotalUser, linearMembers) {
  const choices = linearMembers.map((member) => ({
    name: `${member.name} (${member.email})`,
    value: member,
  }));

  choices.push({ name: "Skip this user", value: null });

  const { selectedMember } = await inquirer.prompt([
    {
      type: "list",
      name: "selectedMember",
      message: `Choose Linear team member for ${chalk.green(pivotalUser)}:`,
      choices: choices,
      pageSize: choices.length, // Show all choices at once
    },
  ]);

  return selectedMember;
}

export default createUserMapping;
