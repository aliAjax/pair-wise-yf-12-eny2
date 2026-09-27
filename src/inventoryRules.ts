// 盘点规则:阈值、状态判定与台账条目均为纯函数,不依赖界面与存储。

export const FROZEN_STATUS = "盘点冻结";
export const DIFF_TOLERANCE = 0.03; // 实盘与账面差异不超过 3% 直接更新
export const LOW_STOCK_LITERS = 10000; // 更新后少于一万升转为库存紧张

export type StocktakeState = "auto-applied" | "pending" | "approved" | "rejected";

export type StocktakeEntry = {
  id: string;
  bookStock: number; // 盘点时账面库存
  actualStock: number; // 实盘量
  diff: number; // 实盘 - 账面
  diffPct: number; // 差异率(小数),账面为 0 且实盘不为 0 时为 Infinity
  countedBy: string; // 盘点人
  countedAt: string;
  previousStatus: string; // 盘点前状态,退回时恢复
  state: StocktakeState;
  reviewedBy?: string; // 复核人(须为另一名人员)
  reviewedAt?: string;
};

export type RecordItem = {
  id: string;
  status: string;
  notes: string;
  createdAt: string;
  stocktakes?: StocktakeEntry[];
  [key: string]: string | number | StocktakeEntry[] | undefined;
};

export const STOCKTAKE_STATE_LABELS: Record<StocktakeState, string> = {
  "auto-applied": "已直接更新",
  pending: "待复核",
  approved: "已放行",
  rejected: "已退回"
};

export function makeStocktake(
  actualStock: number,
  bookStock: number,
  countedBy: string,
  previousStatus: string
): StocktakeEntry {
  const diff = actualStock - bookStock;
  const diffPct = bookStock === 0 ? (diff === 0 ? 0 : Number.POSITIVE_INFINITY) : diff / bookStock;
  return {
    id: crypto.randomUUID(),
    bookStock,
    actualStock,
    diff,
    diffPct,
    countedBy,
    countedAt: new Date().toISOString(),
    previousStatus,
    state: "pending"
  };
}

// 差异率不超过 3% 可直接更新,无需第二人复核
export function isWithinTolerance(entry: StocktakeEntry): boolean {
  return Math.abs(entry.diffPct) <= DIFF_TOLERANCE;
}

// 更新库存后的状态:少于一万升转为库存紧张,否则恢复营业中
export function statusAfterUpdate(stock: number): string {
  return stock < LOW_STOCK_LITERS ? "库存紧张" : "营业中";
}

export function pendingStocktake(record: RecordItem): StocktakeEntry | undefined {
  return record.stocktakes?.find((entry) => entry.state === "pending");
}

export function latestStocktake(record: RecordItem): StocktakeEntry | undefined {
  return record.stocktakes?.[record.stocktakes.length - 1];
}

// 盘点冻结期间不能流转或移出
export function isFrozen(record: RecordItem): boolean {
  return record.status === FROZEN_STATUS && Boolean(pendingStocktake(record));
}

// 复核人须为盘点人之外的另一名人员
export function canReview(entry: StocktakeEntry, reviewedBy: string): boolean {
  const reviewer = reviewedBy.trim();
  return reviewer.length > 0 && reviewer !== entry.countedBy.trim();
}

export function formatDiffPct(entry: StocktakeEntry): string {
  if (!Number.isFinite(entry.diffPct)) return "账面为 0";
  return `${(entry.diffPct * 100).toFixed(1)}%`;
}
