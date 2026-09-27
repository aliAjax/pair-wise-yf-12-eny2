/** 可人工流转的营业状态；盘点冻结为系统状态，不参与流转 */
export type ManualStatus = "营业中" | "暂停营业" | "库存紧张";

export type StationStatus = ManualStatus | "盘点冻结";

/** 盘点单复核结果：提交时为“待复核”，自动更新或人工放行/退回后归档 */
export type CountOutcome = "待复核" | "已自动更新" | "放行" | "退回";

/** 盘点冻结期间保留的现场快照，用于放行更新或退回还原 */
export interface FreezeInfo {
  sessionId: string;
  previousStatus: ManualStatus;
  bookStock: number;
  actualStock: number;
  counter: string;
  frozenAt: string;
}

export interface Station {
  id: string;
  station: string;
  area: string;
  stock: number;
  manager: string;
  status: StationStatus;
  notes: string;
  createdAt: string;
  freeze?: FreezeInfo;
}

/** 本地存档中的一条盘点台账记录 */
export interface CountSession {
  id: string;
  stationId: string;
  stationName: string;
  area: string;
  counter: string;
  bookStock: number;
  actualStock: number;
  /** 差异百分比，保留两位小数 */
  diffRatio: number;
  startedAt: string;
  outcome: CountOutcome;
  reviewer?: string;
  reviewedAt?: string;
}

export type NewStation = Pick<Station, "station" | "area" | "stock" | "manager" | "notes">;
