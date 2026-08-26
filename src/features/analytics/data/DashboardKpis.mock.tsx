import {
  AccountBalanceWalletOutlined,
  AssessmentOutlined,
  CheckCircleOutlineOutlined,
  ErrorOutlineOutlined,
  HourglassEmptyOutlined,
  PaymentsOutlined,
} from "@mui/icons-material";

import type { KpiData } from "../types/dashboard";

export const dashboardKpis: KpiData[] = [
  {
    label: "Total Spend",
    value: "₹4,82,500",
    icon: <AccountBalanceWalletOutlined />,
    description: "This month",
  },
  {
    label: "Pending Approval",
    value: "18",
    icon: <HourglassEmptyOutlined />,
    description: "Expenses awaiting review",
  },
  {
    label: "Approved This Month",
    value: "₹3,24,800",
    icon: <CheckCircleOutlineOutlined />,
    description: "Approved expenses",
  },
  {
    label: "Reimbursed",
    value: "₹2,76,400",
    icon: <PaymentsOutlined />,
    description: "Completed reimbursements",
  },
  {
    label: "Policy Violations",
    value: "7",
    icon: <ErrorOutlineOutlined />,
    description: "Requires attention",
  },
  {
    label: "Budget Utilization",
    value: "68%",
    icon: <AssessmentOutlined />,
    description: "Organization-wide",
  },
];