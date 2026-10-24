/** Utilization bands: amber from 80%, red above 100%. */
export function utilizationColor(percent: number): "primary" | "warning" | "error" {
  if (percent > 100) return "error";
  if (percent >= 80) return "warning";
  return "primary";
}
