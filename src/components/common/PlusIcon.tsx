import { SvgIcon, type SvgIconProps } from "@mui/material";

/** A bold plus with rounded ends, drawn in the current text colour. */
export function PlusIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M12 4.5v15M4.5 12h15" fill="none" stroke="currentColor" strokeWidth={2.75} strokeLinecap="round" />
    </SvgIcon>
  );
}
