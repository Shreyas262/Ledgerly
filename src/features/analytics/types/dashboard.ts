import type { ReactNode } from "react";

export interface KpiData {
  label: string;
  value: string;
  icon: ReactNode;
  description?: string;
}