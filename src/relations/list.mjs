import linearClient from "../../config/client.mjs";

async function fetchRelations() {
  let allRelations = [];
  let hasNextPage = true;
  let endCursor = null;

  while (hasNextPage) {
    const relations = await linearClient.issueRelations({
      first: 100,
      after: endCursor,
    });

    if (relations.nodes.length) {
      relations.nodes.forEach((relation) => allRelations.push(relation));
    }

    hasNextPage = relations.pageInfo.hasNextPage;
    endCursor = relations.pageInfo.endCursor;
  }

  if (allRelations.length) {
    return allRelations;
  } else {
    console.log("No relations found");
  }
}

export default fetchRelations;
