import { useEffect, useState, type ReactNode } from "react";
import { Box, Fab, Tooltip } from "@mui/material";
import { alpha, keyframes } from "@mui/material/styles";
import { Link as RouterLink } from "react-router-dom";

interface FloatingActionProps {
  /** Title Case action name, shown beside the icon and used as the accessible name. */
  label: string;
  to: string;
  icon: ReactNode;
}

/** Past this scroll distance the button folds to its icon so it covers less content. */
const COLLAPSE_AFTER_PX = 80;

const riseIn = keyframes`
  from { opacity: 0; transform: translateY(16px) scale(0.85); }
  to { opacity: 1; transform: none; }
`;

// A ring of the glow colour that widens and fades, every few seconds.
const pulse = (color: string) => keyframes`
  0% { box-shadow: 0 0 0 0 ${alpha(color, 0.55)}; }
  70%, 100% { box-shadow: 0 0 0 14px ${alpha(color, 0)}; }
`;

/**
 * The page's main action, fixed to the bottom right. It opens as a labelled
 * button and folds to a round icon once the user scrolls down. Pages that use
 * it leave about 80px of bottom padding so it never covers their last content.
 */
export function FloatingAction({ label, to, icon }: FloatingActionProps) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const update = () => setCollapsed(window.scrollY > COLLAPSE_AFTER_PX);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    // The label says what the button does while it shows; the tooltip takes over once it folds.
    <Tooltip title={collapsed ? label : ""} placement="left">
      <Fab
        component={RouterLink}
        to={to}
        color="primary"
        variant="extended"
        aria-label={label}
        sx={(theme) => {
          // The brand's light indigo, the same in both modes.
          const glow = theme.palette.brand.activeIcon;
          return {
            position: "fixed",
            right: { xs: "calc(16px + env(safe-area-inset-right, 0px))", sm: 32 },
            bottom: { xs: "calc(16px + env(safe-area-inset-bottom, 0px))", sm: 32 },
            zIndex: theme.zIndex.speedDial,
            height: 60,
            minWidth: 60,
            px: collapsed ? 2 : 2.5,
            borderRadius: 30,
            boxShadow: `${theme.shadows[6]}, 0 0 18px ${alpha(glow, 0.45)}`,
            animation: `${riseIn} 360ms cubic-bezier(0.2, 0, 0, 1) both`,
            transition: theme.transitions.create(["padding", "box-shadow", "transform", "background-color"], {
              duration: theme.transitions.duration.short,
            }),
            // The pulse runs on a layer of its own so it never fights the hover shadow.
            "&::after": {
              content: '""',
              position: "absolute",
              inset: 0,
              borderRadius: "inherit",
              pointerEvents: "none",
            },
            "& .floating-action-icon": {
              transition: theme.transitions.create("transform", { duration: theme.transitions.duration.short }),
            },
            // The glow pulses only while the button is hovered or focused.
            "&:hover, &.Mui-focusVisible": {
              transform: "translateY(-2px)",
              boxShadow: `${theme.shadows[12]}, 0 0 26px ${alpha(glow, 0.65)}`,
              "& .floating-action-icon": { transform: "rotate(90deg)" },
              "&::after": { animation: `${pulse(glow)} 1.6s ease-out infinite` },
            },
            "@media (prefers-reduced-motion: reduce)": {
              animation: "none",
              transition: "none",
              "& .floating-action-icon": { transition: "none" },
              "&:hover, &.Mui-focusVisible": {
                transform: "none",
                "& .floating-action-icon": { transform: "none" },
                "&::after": { animation: "none" },
              },
            },
          };
        }}
      >
        <Box component="span" className="floating-action-icon" sx={{ display: "flex" }}>
          {icon}
        </Box>
        <Box
          component="span"
          aria-hidden={collapsed}
          data-testid="floating-action-label"
          sx={(theme) => ({
            overflow: "hidden",
            whiteSpace: "nowrap",
            maxWidth: collapsed ? 0 : 160,
            ml: collapsed ? 0 : 1,
            opacity: collapsed ? 0 : 1,
            transition: theme.transitions.create(["max-width", "margin", "opacity"], {
              duration: theme.transitions.duration.standard,
            }),
            "@media (prefers-reduced-motion: reduce)": { transition: "none" },
          })}
        >
          {label}
        </Box>
      </Fab>
    </Tooltip>
  );
}
