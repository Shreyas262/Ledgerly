import { Box, Typography } from "@mui/material";

export default function App() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
      }}
    >
      <Typography variant="h4" component="h1">
        Ledgerly
      </Typography>
    </Box>
  );
}