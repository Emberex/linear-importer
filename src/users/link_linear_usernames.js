import { USERNAME_REGEX } from "../constants/regex.js";
import linearClient from "../../config/client.mjs";

// TODO: It would be much better to store the user url in the mapping.
const users = (await linearClient.users()).nodes;

export function linkLinearUsernames({ text, userMapping }) {
  return text.replace(USERNAME_REGEX, (match) => {
    const userEmail = userMapping[match]?.linearEmail;
    const userUrl = users.find(({ email }) => email === userEmail)?.url;
    return userUrl ?? match;
  });
}
