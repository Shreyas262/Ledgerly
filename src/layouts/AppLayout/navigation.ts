import type { ReactNode } from "react";

export interface NavigationItem {
  label: string;
  path: string;
  icon: ReactNode;
}

export interface NavigationSection {
  label: string;
  items: NavigationItem[];
}