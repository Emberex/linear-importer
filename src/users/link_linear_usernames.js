import linearClient from "../../config/client.mjs";
import { USERNAME_REGEX } from "../constants/regex.js";

export async function linkLinearUsernames(text, userMapping) {
  const workspace = (
    await (
      await linearClient.viewer
    ).organization
  ).name.toLowerCase();

  return text.replace(USERNAME_REGEX, (match) => {
    const linearUser = userMapping[match]?.linearName
      ?.replace(" ", ".")
      ?.toLowerCase();
    if (linearUser) {
      return `https://linear.app/${workspace}/profiles/${linearUser}`;
    }
    return match;
  });
}
