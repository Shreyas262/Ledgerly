import { Avatar } from "@mui/material";

import { initialsOf } from "../../utils/format";

const SIZES = {
  small: 32,
  medium: 36,
  large: 56,
};

interface UserAvatarProps {
  name: string | null | undefined;
  /** small: top bar and table rows; medium: lists and cards; large: profile header. */
  size?: keyof typeof SIZES;
}

/** A person's initials in the accent tone. Decorative: the name is always shown or labelled beside it. */
export function UserAvatar({ name, size = "medium" }: UserAvatarProps) {
  const pixels = SIZES[size];

  return (
    <Avatar aria-hidden="true" sx={{ width: pixels, height: pixels, fontSize: pixels * 0.4 }}>
      {initialsOf(name)}
    </Avatar>
  );
}
