import { fileURLToPath } from "url";

import { createReadStream } from "fs";
import { parse } from "csv-parse";
import fs from "fs/promises";
import path from "path";

import { buildFormattedIssue } from "./pivotal/_build_formatted_issue.js";

import { detailedLogger } from "../../logger/logger_instance.js";

// Function to read and parse CSV
function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const issues = [];
    const labels = new Set();
    const userNames = new Set();

    createReadStream(filePath)
      .pipe(
        parse({
          columns: true,
          group_columns_by_name: true,
          trim: true,
          relax_column_count: true,
        }),
      )
      .on("data", (row) => {
        const formattedIssue = buildFormattedIssue(row);

        if (row["Requested By"]) userNames.add(row["Requested By"]);

        if (row["Owned By"]) {
          (Array.isArray(row["Owned By"]) ? row["Owned By"] : [row["Owned By"]])
            .filter((owner) => owner)
            .forEach((owner) => userNames.add(owner));
        }

        if (row["Labels"]) {
          row["Labels"]
            .split(",")
            .map((label) => label.trim())
            .filter((label) => label)
            .forEach((label) => labels.add(label));
        }

        issues.push(formattedIssue);
      })
      .on("end", () =>
        resolve({
          issues,
          aggregatedData: {
            userNames: Array.from(userNames),
            labels: buildLabelsArray(labels),
          },
        }),
      )
      .on("error", reject);
  });
}

function buildLabelsArray(labels) {
  return Array.from(labels).map((label) => ({
    name: label,
    color: "#6C757D",
  }));
}

// Main function to run the script
async function parseCSV(selectedDirectory) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const assetsDir = path.join(__dirname, "..", "..", "assets");

  const csvFilename = `${selectedDirectory.replace("-export", "")}.csv`;
  const filePath = path.join(assetsDir, selectedDirectory, csvFilename);

  detailedLogger.info(`Parsing CSV file: ${csvFilename}`);

  return parseCSVFile(csvFilename, filePath);
}

export async function parseCSVFile(csvFilename, filePath) {
  if (
    !(await fs
      .access(filePath)
      .then(() => true)
      .catch(() => false))
  ) {
    detailedLogger.importantError(`CSV file not found: ${csvFilename}`);
    process.exit(0);
  }

  const data = await readCSV(filePath);

  detailedLogger.info(`CSV Data: ${JSON.stringify(data, null, 2)}`);

  return data;
}

export default parseCSV;
