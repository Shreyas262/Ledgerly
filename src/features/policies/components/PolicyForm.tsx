import { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from "@mui/material";

import type {
  CreateExpensePolicyRequest,
  PolicyStatus,
} from "../../../types/policy";

interface PolicyFormProps {
  initialValues?: CreateExpensePolicyRequest;
  onSubmit: (values: CreateExpensePolicyRequest) => void;
  isSubmitting?: boolean;
}

const defaultValues: CreateExpensePolicyRequest = {
  name: "",
  description: "",
  approvalLimit: 50000,
  status: "active",
};

function PolicyForm({
  initialValues = defaultValues,
  onSubmit,
  isSubmitting = false,
}: PolicyFormProps) {
  const [name, setName] = useState(initialValues.name);
  const [description, setDescription] = useState(
    initialValues.description ?? "",
  );
  const [approvalLimit, setApprovalLimit] = useState(
    String(initialValues.approvalLimit),
  );
  const [status, setStatus] = useState<PolicyStatus>(initialValues.status);

  const [errors, setErrors] = useState({
    name: "",
    approvalLimit: "",
  });

  useEffect(() => {
    setName(initialValues.name);
    setDescription(initialValues.description ?? "");
    setApprovalLimit(String(initialValues.approvalLimit));
    setStatus(initialValues.status);
  }, [initialValues]);

  const validate = () => {
    const nextErrors = {
      name: "",
      approvalLimit: "",
    };

    if (!name.trim()) {
      nextErrors.name = "Policy name is required.";
    }

    const numericLimit = Number(approvalLimit);

    if (!approvalLimit || Number.isNaN(numericLimit)) {
      nextErrors.approvalLimit = "Approval limit is required.";
    } else if (numericLimit <= 0) {
      nextErrors.approvalLimit = "Approval limit must be greater than 0.";
    }

    setErrors(nextErrors);

    return !nextErrors.name && !nextErrors.approvalLimit;
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      approvalLimit: Number(approvalLimit),
      status,
    });
  };

  return (
    <Card>
      <CardContent>
        <Stack
          component="form"
          onSubmit={handleSubmit}
          spacing={3}
        >
          <TextField
            label="Policy Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={Boolean(errors.name)}
            helperText={errors.name}
            fullWidth
            required
          />

          <TextField
            label="Description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            multiline
            minRows={3}
            fullWidth
          />

          <TextField
            label="Approval Limit"
            type="number"
            value={approvalLimit}
            onChange={(event) => setApprovalLimit(event.target.value)}
            error={Boolean(errors.approvalLimit)}
            helperText={
              errors.approvalLimit || "Amount is in INR."
            }
            slotProps={{
                htmlInput: { min: 1 },
            }}
            fullWidth
            required
          />

          <FormControl fullWidth>
            <InputLabel id="policy-status-label">
              Status
            </InputLabel>

            <Select
              labelId="policy-status-label"
              value={status}
              label="Status"
              onChange={(event) =>
                setStatus(event.target.value as PolicyStatus)
              }
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </Select>

            <FormHelperText>
              Inactive policies are not used for new expense evaluations.
            </FormHelperText>
          </FormControl>

          <Button
            type="submit"
            variant="contained"
            loading={isSubmitting}
          >
            Save Policy
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default PolicyForm;