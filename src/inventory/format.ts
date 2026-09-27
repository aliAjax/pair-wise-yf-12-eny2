export function formatLiters(value: number): string {
  return `${Math.round(value).toLocaleString("zh-CN")} L`;
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function formatRatio(ratio: number): string {
  return `${ratio.toFixed(2)}%`;
}
