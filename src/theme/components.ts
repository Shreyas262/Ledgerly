import { alpha, darken } from "@mui/material/styles";
import type { Components, Theme } from "@mui/material/styles";

type SemanticColor = "success" | "warning" | "error" | "info";

// Soft, readable tones for status-bearing components (chips, alerts).
const statusTone = (theme: Theme, color: string | undefined) => {
  const { status } = theme.palette;

  switch (color as SemanticColor | undefined) {
    case "success":
      return status.approved;
    case "warning":
      return status.pending;
    case "error":
      return status.rejected;
    case "info":
      return status.info;
    default:
      return undefined;
  }
};

export const components: Components<Omit<Theme, "components">> = {
  MuiButtonBase: {
    styleOverrides: {
      root: ({ theme }) => ({
        "&:focus-visible": {
          outline: `3px solid ${alpha(theme.palette.info.main, 0.6)}`,
          outlineOffset: "2px",
        },
      }),
    },
  },

  MuiTypography: {
    defaultProps: {
      variantMapping: {
        // h4 is the page-title style; render it as the page's single h1.
        h4: "h1",
        kpi: "p",
        amount: "span",
      },
    },
  },

  MuiButton: {
    defaultProps: {
      disableElevation: true,
    },
    styleOverrides: {
      root: ({ theme, ownerState }) => ({
        borderRadius: 8,
        fontWeight: 600,
        paddingInline: theme.spacing(2),
        "&.Mui-disabled": {
          opacity: 0.7,
        },
        // Deeper red keeps white label text at AA contrast.
        ...(theme.palette.mode === "light" &&
          ownerState.variant === "contained" &&
          ownerState.color === "error" && {
            backgroundColor: theme.palette.error.dark,
            "&:hover": {
              backgroundColor: darken(theme.palette.error.dark, 0.12),
            },
          }),
      }),
      sizeSmall: ({ theme }) => ({
        paddingInline: theme.spacing(1.5),
      }),
    },
  },

  MuiIconButton: {
    styleOverrides: {
      root: {
        borderRadius: 8,
      },
    },
  },

  MuiPaper: {
    styleOverrides: {
      root: {
        backgroundImage: "none",
      },
      outlined: ({ theme }) => ({
        borderColor: theme.palette.divider,
      }),
    },
  },

  MuiCard: {
    defaultProps: {
      variant: "outlined",
    },
    styleOverrides: {
      root: {
        borderRadius: 12,
      },
    },
  },

  MuiCardContent: {
    styleOverrides: {
      root: ({ theme }) => ({
        padding: theme.spacing(2.5),
        "&:last-child": {
          paddingBottom: theme.spacing(2.5),
        },
      }),
    },
  },

  MuiAppBar: {
    defaultProps: {
      elevation: 0,
      color: "inherit",
    },
    styleOverrides: {
      root: ({ theme }) => {
        const { sidebar } = theme.palette;

        return {
          backgroundColor: sidebar.background,
          backgroundImage: sidebar.topbarGradient,
          color: sidebar.text,
          borderBottom: `1px solid ${sidebar.border}`,
          "& .MuiIconButton-root": {
            color: sidebar.textMuted,
          },
          "& .MuiIconButton-root:hover": {
            backgroundColor: sidebar.hover,
            color: sidebar.text,
          },
          "& .MuiAvatar-colorDefault": {
            backgroundColor: alpha(sidebar.activeIcon, 0.16),
            color: sidebar.activeIcon,
          },
        };
      },
    },
  },

  MuiOutlinedInput: {
    styleOverrides: {
      root: ({ theme }) => {
        const idleBorder =
          theme.palette.mode === "light"
            ? theme.palette.grey[300]
            : theme.palette.grey[700];

        return {
          borderRadius: 8,
          backgroundColor: theme.palette.background.paper,
          transition: theme.transitions.create(["box-shadow", "border-color"]),
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: idleBorder,
          },
          "&:hover:not(.Mui-disabled):not(.Mui-error) .MuiOutlinedInput-notchedOutline":
            {
              borderColor: theme.palette.text.secondary,
            },
          "&.Mui-focused:not(.Mui-error) .MuiOutlinedInput-notchedOutline": {
            borderColor: theme.palette.primary.main,
            borderWidth: 1,
          },
          "&.Mui-focused": {
            boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.12)}`,
          },
          "&.Mui-focused.Mui-error": {
            boxShadow: `0 0 0 3px ${alpha(theme.palette.error.main, 0.15)}`,
          },
          "&.Mui-disabled": {
            backgroundColor: theme.palette.action.hover,
          },
          "&.Mui-disabled .MuiOutlinedInput-notchedOutline": {
            borderColor: theme.palette.divider,
          },
        };
      },
    },
  },

  MuiMenu: {
    styleOverrides: {
      paper: ({ theme }) => ({
        marginTop: theme.spacing(0.5),
        border: `1px solid ${theme.palette.divider}`,
        boxShadow: theme.shadows[6],
      }),
      list: ({ theme }) => ({
        padding: theme.spacing(0.5),
      }),
    },
  },

  MuiMenuItem: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: 6,
        minHeight: 36,
        "&.Mui-selected": {
          backgroundColor: theme.palette.action.selected,
        },
        "&.Mui-selected:hover": {
          backgroundColor: theme.palette.action.selected,
        },
      }),
    },
  },

  MuiChip: {
    styleOverrides: {
      root: ({ theme, ownerState }) => {
        const base = {
          borderRadius: 999,
          fontWeight: 500,
        };

        if (ownerState.variant === "outlined") {
          return base;
        }

        const tone =
          statusTone(theme, ownerState.color) ??
          (ownerState.color === "primary"
            ? {
                bg: alpha(theme.palette.primary.main, 0.08),
                fg: theme.palette.primary.main,
              }
            : ownerState.color === "secondary"
              ? theme.palette.status.approved
              : theme.palette.status.draft);

        return {
          ...base,
          backgroundColor: tone.bg,
          color: tone.fg,
          "& .MuiChip-icon, & .MuiChip-deleteIcon": {
            color: tone.fg,
          },
        };
      },
      label: {
        fontSize: "0.75rem",
      },
    },
  },

  MuiAlert: {
    styleOverrides: {
      root: ({ theme, ownerState }) => {
        const tone = statusTone(theme, ownerState.severity);

        if (ownerState.variant !== "standard" || !tone) {
          return { borderRadius: 8 };
        }

        return {
          borderRadius: 8,
          backgroundColor: tone.bg,
          color: tone.fg,
          border: `1px solid ${alpha(tone.fg, 0.2)}`,
          "& .MuiAlert-icon": {
            color: tone.fg,
          },
        };
      },
    },
  },

  MuiDialog: {
    styleOverrides: {
      paper: ({ theme }) => ({
        borderRadius: 16,
        border: `1px solid ${theme.palette.divider}`,
      }),
    },
  },

  MuiDialogActions: {
    styleOverrides: {
      root: ({ theme }) => ({
        padding: theme.spacing(2, 3),
      }),
    },
  },

  MuiDrawer: {
    styleOverrides: {
      paper: {
        backgroundImage: "none",
      },
    },
  },

  MuiTabs: {
    styleOverrides: {
      root: {
        minHeight: 44,
      },
      indicator: ({ theme }) => ({
        height: 2,
        backgroundColor: theme.palette.primary.main,
      }),
    },
  },

  MuiTab: {
    styleOverrides: {
      root: ({ theme }) => ({
        minHeight: 44,
        paddingInline: theme.spacing(2),
        color: theme.palette.text.secondary,
        "&.Mui-selected": {
          color: theme.palette.text.primary,
        },
      }),
    },
  },

  MuiTableCell: {
    styleOverrides: {
      root: ({ theme }) => ({
        padding: theme.spacing(1.5, 2),
        borderBottom: `1px solid ${theme.palette.divider}`,
        fontVariantNumeric: "tabular-nums",
      }),
      head: ({ theme }) => ({
        fontSize: "0.75rem",
        fontWeight: 600,
        letterSpacing: "0.02em",
        color: theme.palette.text.secondary,
        backgroundColor:
          theme.palette.mode === "light"
            ? theme.palette.grey[50]
            : theme.palette.background.paper,
        whiteSpace: "nowrap",
      }),
      body: {
        fontSize: "0.875rem",
      },
      sizeSmall: ({ theme }) => ({
        padding: theme.spacing(1, 1.5),
      }),
    },
  },

  MuiTableRow: {
    styleOverrides: {
      root: ({ theme }) => ({
        "&.MuiTableRow-hover:hover": {
          backgroundColor: theme.palette.action.hover,
        },
        "&.Mui-selected, &.Mui-selected:hover": {
          backgroundColor: alpha(theme.palette.primary.main, 0.06),
        },
        "&:last-child td": {
          borderBottom: 0,
        },
      }),
    },
  },

  MuiPaginationItem: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        fontWeight: 500,
        fontVariantNumeric: "tabular-nums",
      },
    },
  },

  MuiLinearProgress: {
    styleOverrides: {
      root: ({ theme }) => ({
        height: 6,
        borderRadius: 999,
        backgroundColor:
          theme.palette.mode === "light"
            ? theme.palette.grey[200]
            : theme.palette.grey[800],
      }),
      bar: {
        borderRadius: 999,
      },
    },
  },

  MuiAvatar: {
    styleOverrides: {
      colorDefault: ({ theme }) => ({
        backgroundColor: theme.palette.primary.main,
        color: theme.palette.primary.contrastText,
        fontSize: "0.875rem",
        fontWeight: 600,
      }),
    },
  },
};
