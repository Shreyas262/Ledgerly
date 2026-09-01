import { Box, Button, Stack, Typography } from "@mui/material"
import { NavLink } from "react-router-dom"

export function NotFound() {
  return (
    <Stack 
        direction={"column"}
        sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
        }}
        spacing={2}
    >
        <Typography
            variant="h3"
        >
            Page Not Found.
        </Typography>
        <Typography component={"p"}>
            The page you are looking for does not exists...
        </Typography>
        <Button variant="contained" component={NavLink} to={"/dashboard"}>
            Return to Dashboard
        </Button>
    </Stack>
  )
}