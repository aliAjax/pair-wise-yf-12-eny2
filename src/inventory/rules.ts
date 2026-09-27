import type { ManualStatus } from "./types";

/** 实盘与账面差异允许直接更新的上限（含） */
export const DIFF_LIMIT_PERCENT = 3;

/** 库存低于该升数时状态转为“库存紧张” */
export const LOW_STOCK_LITERS = 10000;

/** 人工流转的状态顺序，盘点冻结不在其中 */
export const MANUAL_STATUSES: readonly ManualStatus[] = ["营业中", "暂停营业", "库存紧张"];

export interface CountRule {
  title: string;
  detail: string;
}

/** 盘点规则文案，与卡片操作、本地存档分开承载，复核前后均可查看 */
export const COUNT_RULES: readonly CountRule[] = [
  {
    title: "发起盘点",
    detail: "仅“营业中”的站点可以填写实盘量并提交，提交后立即进入盘点冻结。"
  },
  {
    title: "冻结限制",
    detail: "盘点冻结期间站点不能流转状态，也不能移出（删除）；需等自动更新或复核结束后才能恢复操作。"
  },
  {
    title: "差异不超过 3%",
    detail: "实盘量与账面库存差异不超过 3% 时直接按实盘量更新库存，无需复核：实盘量少于 10,000 升转为“库存紧张”，否则恢复“营业中”。"
  },
  {
    title: "差异超过 3%",
    detail: "保留原账面库存，站点维持盘点冻结，等待另一名人员复核放行。复核人不得与盘点人为同一人。"
  },
  {
    title: "放行",
    detail: "复核放行后按实盘量更新库存：少于 10,000 升转为“库存紧张”，否则恢复“营业中”。"
  },
  {
    title: "退回",
    detail: "复核退回后，站点恢复盘点前的原状态与原账面库存，盘点单留档备查。"
  },
  {
    title: "台账存档",
    detail: "盘点单在提交时即写入本地存档，复核前显示“待复核”，复核后更新结果与复核人，两个阶段均可随时查看。"
  }
];

/** 计算实盘与账面的差异百分比；账面为 0 时只要实盘非 0 即视为超过阈值 */
export function diffPercent(bookStock: number, actualStock: number): number {
  if (bookStock <= 0) return actualStock === bookStock ? 0 : 100;
  return (Math.abs(actualStock - bookStock) / bookStock) * 100;
}

/** 按实盘量确定盘点结束后的目标状态 */
export function targetStatus(actualStock: number): ManualStatus {
  return actualStock < LOW_STOCK_LITERS ? "库存紧张" : "营业中";
}
