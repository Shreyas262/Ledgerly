import { Box, Chip, Stack, Typography } from "@mui/material";
import type { Permission } from "../types/role";
import { permissionGroups } from "../constants/permissions";

interface GroupedPermissionsProps {
  permissions: readonly Permission[] | readonly string[];
}

const actionLabel = (permission: string) => {
  const action = permission.split(".")[1] ?? permission;
  return action.charAt(0).toUpperCase() + action.slice(1);
};

/** Permissions grouped by area, each shown as its action (Read, Create, …). */
export function GroupedPermissions({ permissions }: GroupedPermissionsProps) {
  const granted = new Set<string>(permissions);
  const known = new Set<string>(Object.values(permissionGroups).flat());
  const groups = Object.entries(permissionGroups)
    .map(([group, items]) => ({ group, items: items.filter((permission) => granted.has(permission)) }))
    .filter((entry) => entry.items.length > 0);
  const other = [...granted].filter((permission) => !known.has(permission));
  if (other.length) groups.push({ group: "Other", items: other as Permission[] });

  if (groups.length === 0) {
    return <Typography variant="body2" color="text.secondary">No permissions assigned.</Typography>;
  }

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
        columnGap: 3,
        rowGap: 1.25,
      }}
    >
      {groups.map(({ group, items }) => (
        <Stack key={group} direction="row" spacing={1.5} sx={{ alignItems: "baseline", minWidth: 0 }}>
          <Typography variant="body2" color="text.secondary" sx={{ width: 120, flexShrink: 0 }}>
            {group}
          </Typography>
          <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
            {items.map((permission) => (
              <Chip key={permission} label={actionLabel(permission)} size="small" variant="outlined" title={permission} />
            ))}
          </Stack>
        </Stack>
      ))}
    </Box>
  );
}
