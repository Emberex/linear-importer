import linearClient from "../../config/client.mjs";

async function fetchIssuesForTeam({ teamId, filters }) {
  const filter = {};
  if (teamId) filter.team = { id: { eq: teamId } };
  if (filters) Object.assign(filter, filters);

  let allIssues = [];
  let hasNextPage = true;
  let endCursor = null;

  while (hasNextPage) {
    const filteredIssues = await linearClient.issues({
      filter,
      first: 100,
      after: endCursor,
    });

    if (filteredIssues.nodes.length) {
      filteredIssues.nodes.forEach((issue) => {
        const data = {
          id: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          createdAt: issue.createdAt,
          description: issue.description,
        };
        allIssues.push(data);
      });
    }

    hasNextPage = filteredIssues.pageInfo.hasNextPage;
    endCursor = filteredIssues.pageInfo.endCursor;
  }

  if (allIssues.length) {
    return allIssues;
  } else {
    console.log("No issues found matching the criteria");
  }
}

export default fetchIssuesForTeam;
