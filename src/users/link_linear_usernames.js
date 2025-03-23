import { USERNAME_REGEX } from "../constants/regex.js";

export function linkLinearUsernames({ text, userMapping }) {
  return text.replace(USERNAME_REGEX, (match) => {
    const userUrl = userMapping[match]?.linearProfileUrl;
    return userUrl ?? match;
  });
}
