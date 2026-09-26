import type { ReactNode } from "react";
import { ChevronRightOutlined } from "@mui/icons-material";
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

export interface SectionHubItem {
  label: string;
  description: string;
  path: string;
  icon: ReactNode;
}

interface SectionHubProps {
  title: string;
  description: string;
  items: SectionHubItem[];
  footer?: ReactNode;
}

/** Landing page for a group of related pages (e.g. Account, Administration). */
export function SectionHub({ title, description, items }: SectionHubProps) {
  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography variant="h4">{title}</Typography>
        <Typography color="text.secondary">{description}</Typography>
      </Stack>

      <Grid container spacing={2}>
        {items.map((item) => (
          <Grid key={item.path} size={{ xs: 12, sm: 6, lg: 4 }}>
            <Card sx={{ height: "100%" }}>
              <CardActionArea
                component={RouterLink}
                to={item.path}
                sx={{ height: "100%" }}
              >
                <CardContent>
                  <Stack
                    direction="row"
                    spacing={2}
                    sx={{ alignItems: "flex-start" }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        p: 1,
                        borderRadius: 1.5,
                        bgcolor: "action.hover",
                        color: "primary.main",
                      }}
                    >
                      {item.icon}
                    </Box>
                    <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="h6">{item.label}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {item.description}
                      </Typography>
                    </Stack>
                    <ChevronRightOutlined color="action" />
                  </Stack>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}
