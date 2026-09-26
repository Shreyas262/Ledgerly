/** Turns a code such as `USER_CREATED` or `under_review` into "User created". */
export const humanize = (value: string): string => {
  const words = value.replace(/[_-]+/g, " ").trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};
