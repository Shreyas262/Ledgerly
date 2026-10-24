import { useRef, useState, type ElementType, type ReactNode } from "react";
import { Tooltip, Typography, type TypographyProps } from "@mui/material";

type TruncatedTextProps<C extends ElementType> = TypographyProps<C, { component?: C }> & {
  children: ReactNode;
  /** Full text for the tooltip; defaults to the children when they are a string. */
  title?: string;
};

/** Single-line text cut with an ellipsis; hovering or focusing it shows the full text, only when it is cut. */
export function TruncatedText<C extends ElementType = "span">({ children, title, sx, ...props }: TruncatedTextProps<C>) {
  const textRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const fullText = title ?? (typeof children === "string" ? children : "");

  // The tooltip opens after a delay, when the event no longer has a target: measure the element itself.
  const handleOpen = () => {
    const element = textRef.current;
    setOpen(Boolean(element && element.scrollWidth > element.clientWidth));
  };

  return (
    <Tooltip title={fullText} open={open && Boolean(fullText)} onOpen={handleOpen} onClose={() => setOpen(false)} describeChild>
      <Typography ref={textRef} noWrap sx={[{ display: "block", minWidth: 0 }, ...(Array.isArray(sx) ? sx : [sx])]} {...props}>
        {children}
      </Typography>
    </Tooltip>
  );
}
