import { useState, type ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Divider,
  FormControlLabel,
  InputAdornment,
  ListItemText,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";

import type {
  CreateExpensePolicyRequest,
  PolicyRules,
  PolicyStatus,
  RuleEnforcement,
} from "../types/policy";
import { EXPENSE_TYPE_LABELS, EXPENSE_TYPES, type ExpenseType } from "../../expenses/types/expense";
import { useGetDepartmentsQuery } from "../../organizations/api/organizationApi";
import { DETAILED_DESCRIPTION_MIN } from "../utils/policyConstants";

interface PolicyFormProps {
  initialValues?: CreateExpensePolicyRequest;
  onSubmit: (values: CreateExpensePolicyRequest) => void;
  isSubmitting?: boolean;
}

const defaultValues: CreateExpensePolicyRequest = {
  name: "",
  description: "",
  expenseType: undefined,
  departmentIds: [],
  rules: { approvalThreshold: 10000, maximumAmount: { amount: 50000, enforcement: "BLOCK" } },
  status: "draft",
};

type RuleKey = keyof PolicyRules;

/** Editable state for one rule: enabled flag, value text and enforcement. */
interface RuleDraft {
  enabled: boolean;
  value: string;
  enforcement: RuleEnforcement;
}

function toDrafts(rules: PolicyRules): Record<RuleKey, RuleDraft> {
  const draft = (enabled: boolean, value: number | undefined, enforcement: RuleEnforcement = "BLOCK"): RuleDraft => ({
    enabled,
    value: value === undefined ? "" : String(value),
    enforcement,
  });
  return {
    maximumAmount: draft(Boolean(rules.maximumAmount), rules.maximumAmount?.amount, rules.maximumAmount?.enforcement),
    approvalThreshold: draft(rules.approvalThreshold !== undefined, rules.approvalThreshold),
    monthlyLimit: draft(Boolean(rules.monthlyLimit), rules.monthlyLimit?.amount, rules.monthlyLimit?.enforcement ?? "WARN"),
    submissionDeadline: draft(Boolean(rules.submissionDeadline), rules.submissionDeadline?.days ?? 30, rules.submissionDeadline?.enforcement ?? "WARN"),
    descriptionRequiredAbove: draft(Boolean(rules.descriptionRequiredAbove), rules.descriptionRequiredAbove?.amount, rules.descriptionRequiredAbove?.enforcement),
    duplicateCheck: draft(Boolean(rules.duplicateCheck), undefined, rules.duplicateCheck?.enforcement ?? "WARN"),
    noFutureDates: draft(Boolean(rules.noFutureDates), undefined, rules.noFutureDates?.enforcement),
  };
}

const RULE_DEFINITIONS: Array<{
  key: RuleKey;
  title: string;
  help: string;
  input?: "amount" | "days";
  inputLabel?: string;
  hasEnforcement: boolean;
}> = [
  { key: "maximumAmount", title: "Maximum amount", help: "The largest amount allowed for a single expense.", input: "amount", inputLabel: "Maximum per expense", hasEnforcement: true },
  { key: "approvalThreshold", title: "Approval threshold", help: "Above this amount the expense goes to a more senior approver: team members' expenses to Finance, managers' expenses to an administrator.", input: "amount", inputLabel: "Threshold", hasEnforcement: false },
  { key: "monthlyLimit", title: "Monthly limit per employee", help: "Each employee's total for this policy's expense type in a calendar month. Counts submitted expenses that are not rejected or cancelled.", input: "amount", inputLabel: "Monthly limit", hasEnforcement: true },
  { key: "submissionDeadline", title: "Submission deadline", help: "Expenses must be submitted within this many days of the expense date.", input: "days", inputLabel: "Days", hasEnforcement: true },
  { key: "descriptionRequiredAbove", title: "Detailed description", help: `Above this amount the description must be at least ${DETAILED_DESCRIPTION_MIN} characters, as a justification.`, input: "amount", inputLabel: "Required above", hasEnforcement: true },
  { key: "duplicateCheck", title: "Duplicate check", help: "Flags another expense by the same employee with the same type, amount and date.", hasEnforcement: true },
  { key: "noFutureDates", title: "No future dates", help: "The expense date cannot be later than today.", hasEnforcement: true },
];

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card>
      <CardContent>
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="h6">{title}</Typography>
            {description && <Typography variant="body2" color="text.secondary">{description}</Typography>}
          </Box>
          {children}
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function PolicyForm({
  initialValues = defaultValues,
  onSubmit,
  isSubmitting = false,
}: PolicyFormProps) {
  const { data: departments = [] } = useGetDepartmentsQuery();
  const [name, setName] = useState(initialValues.name);
  const [description, setDescription] = useState(initialValues.description ?? "");
  const [status, setStatus] = useState<PolicyStatus>(initialValues.status);
  const [expenseType, setExpenseType] = useState<ExpenseType | "">(initialValues.expenseType ?? "");
  const [scope, setScope] = useState<"organization" | "departments">(initialValues.departmentIds?.length ? "departments" : "organization");
  const [departmentIds, setDepartmentIds] = useState<string[]>(initialValues.departmentIds ?? []);
  const [rules, setRules] = useState(() => toDrafts(initialValues.rules));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateRule = (key: RuleKey, patch: Partial<RuleDraft>) =>
    setRules((current) => ({ ...current, [key]: { ...current[key], ...patch } }));

  const buildRules = (nextErrors: Record<string, string>): PolicyRules => {
    const result: PolicyRules = {};
    for (const definition of RULE_DEFINITIONS) {
      const draft = rules[definition.key];
      if (!draft.enabled) continue;
      let value = 0;
      if (definition.input) {
        value = Number(draft.value);
        const valid = definition.input === "days"
          ? Number.isInteger(value) && value >= 1 && value <= 365
          : Number.isFinite(value) && value > 0;
        if (!draft.value || !valid) {
          nextErrors[definition.key] = definition.input === "days" ? "Enter 1 to 365 days." : "Enter an amount greater than 0.";
          continue;
        }
      }
      switch (definition.key) {
        case "approvalThreshold":
          result.approvalThreshold = value;
          break;
        case "maximumAmount":
        case "monthlyLimit":
        case "descriptionRequiredAbove":
          result[definition.key] = { amount: value, enforcement: draft.enforcement };
          break;
        case "submissionDeadline":
          result.submissionDeadline = { days: value, enforcement: draft.enforcement };
          break;
        case "duplicateCheck":
        case "noFutureDates":
          result[definition.key] = { enforcement: draft.enforcement };
          break;
      }
    }
    return result;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = "Policy name is required.";
    if (scope === "departments" && departmentIds.length === 0) nextErrors.departmentIds = "Choose at least one department.";
    const builtRules = buildRules(nextErrors);
    if (!Object.keys(builtRules).length && !Object.keys(nextErrors).length) nextErrors.rules = "Turn on at least one rule.";
    if (
      builtRules.maximumAmount?.enforcement === "BLOCK" &&
      builtRules.approvalThreshold !== undefined &&
      builtRules.approvalThreshold >= builtRules.maximumAmount.amount
    ) {
      nextErrors.approvalThreshold = "The threshold must be below the blocking maximum amount.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      expenseType: expenseType || undefined,
      departmentIds: scope === "departments" ? departmentIds : [],
      rules: builtRules,
      status,
    });
  };

  return (
    <Stack component="form" spacing={3} onSubmit={handleSubmit} noValidate>
      <Section title="Details">
        <TextField
          label="Policy name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={Boolean(errors.name)}
          helperText={errors.name}
          required
          fullWidth
        />
        <TextField
          label="Description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          multiline
          minRows={2}
          fullWidth
        />
        <TextField
          select
          label="Status"
          value={status}
          onChange={(event) => setStatus(event.target.value as PolicyStatus)}
          helperText="Only active policies are applied. One active policy per expense type and department."
          sx={{ maxWidth: 360 }}
        >
          <MenuItem value="draft">Draft</MenuItem>
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="inactive">Inactive</MenuItem>
        </TextField>
      </Section>

      <Section title="Applies to" description="The most specific active policy wins: a type-specific policy over an all-types one, then a department policy over an organization-wide one.">
        <TextField
          select
          label="Expense type"
          value={expenseType}
          onChange={(event) => setExpenseType(event.target.value as ExpenseType | "")}
          sx={{ maxWidth: 360 }}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
        >
          <MenuItem value="">All expense types</MenuItem>
          {EXPENSE_TYPES.map((type) => (
            <MenuItem key={type} value={type}>{EXPENSE_TYPE_LABELS[type]}</MenuItem>
          ))}
        </TextField>
        <RadioGroup row value={scope} onChange={(event) => setScope(event.target.value as typeof scope)}>
          <FormControlLabel value="organization" control={<Radio />} label="Whole organization" />
          <FormControlLabel value="departments" control={<Radio />} label="Specific departments" />
        </RadioGroup>
        {scope === "departments" && (
          <TextField
            select
            label="Departments"
            value={departmentIds}
            onChange={(event) => setDepartmentIds(typeof event.target.value === "string" ? event.target.value.split(",") : event.target.value)}
            error={Boolean(errors.departmentIds)}
            helperText={errors.departmentIds ?? "This policy overrides the organization-wide policy for these departments."}
            sx={{ maxWidth: 480 }}
            slotProps={{
              select: {
                multiple: true,
                renderValue: (selected) =>
                  (selected as string[]).map((id) => departments.find((department) => department.id === id)?.name ?? id).join(", "),
              },
            }}
          >
            {departments.map((department) => (
              <MenuItem key={department.id} value={department.id}>
                <Checkbox size="small" checked={departmentIds.includes(department.id)} />
                <ListItemText primary={department.name} />
              </MenuItem>
            ))}
          </TextField>
        )}
      </Section>

      <Section title="Rules" description="Blocking rules stop submission. Warning rules let the expense through and show the warning to reviewers.">
        <Alert severity="info" icon={<ReceiptLongOutlinedIcon />}>
          A receipt or supporting document is always required before submission, with or without a policy.
        </Alert>
        {errors.rules && <Alert severity="error">{errors.rules}</Alert>}
        <Stack divider={<Divider flexItem />} spacing={2}>
          {RULE_DEFINITIONS.map((definition) => {
            const draft = rules[definition.key];
            return (
              <Stack key={definition.key} direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" } }}>
                <FormControlLabel
                  sx={{ flex: 1, alignItems: "flex-start", m: 0 }}
                  control={<Switch checked={draft.enabled} onChange={(event) => updateRule(definition.key, { enabled: event.target.checked })} />}
                  label={
                    <Box sx={{ pt: 0.75 }}>
                      <Typography variant="subtitle2">{definition.title}</Typography>
                      <Typography variant="body2" color="text.secondary">{definition.help}</Typography>
                    </Box>
                  }
                />
                {draft.enabled && (
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start", flexShrink: 0 }}>
                    {definition.input && (
                      <TextField
                        size="small"
                        type="number"
                        label={definition.inputLabel}
                        value={draft.value}
                        onChange={(event) => updateRule(definition.key, { value: event.target.value })}
                        error={Boolean(errors[definition.key])}
                        helperText={errors[definition.key]}
                        sx={{ width: 180 }}
                        slotProps={{
                          input: definition.input === "amount"
                            ? { startAdornment: <InputAdornment position="start">₹</InputAdornment> }
                            : { endAdornment: <InputAdornment position="end">days</InputAdornment> },
                          htmlInput: { min: 1 },
                        }}
                      />
                    )}
                    {definition.hasEnforcement && (
                      <ToggleButtonGroup
                        size="small"
                        exclusive
                        value={draft.enforcement}
                        onChange={(_event, value: RuleEnforcement | null) => value && updateRule(definition.key, { enforcement: value })}
                        aria-label={`${definition.title} enforcement`}
                        sx={{ height: 40 }}
                      >
                        <ToggleButton value="BLOCK" sx={{ px: 2 }}>Block</ToggleButton>
                        <ToggleButton value="WARN" sx={{ px: 2 }}>Warn</ToggleButton>
                      </ToggleButtonGroup>
                    )}
                  </Stack>
                )}
              </Stack>
            );
          })}
        </Stack>
      </Section>

      <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
        <Button type="submit" variant="contained" disabled={isSubmitting} sx={{ minWidth: 160 }}>
          {isSubmitting ? "Saving…" : "Save Policy"}
        </Button>
      </Stack>
    </Stack>
  );
}
