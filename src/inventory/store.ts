import { computed, ref } from "vue";
import {
  DIFF_LIMIT_PERCENT,
  LOW_STOCK_LITERS,
  MANUAL_STATUSES,
  diffPercent,
  targetStatus
} from "./rules";
import type { CountOutcome, CountSession, ManualStatus, NewStation, Station, StationStatus } from "./types";

const STATION_KEY = "hxwlfront-21-station-map";
const SESSION_KEY = "hxwlfront-21-count-sessions";

/** 仅在本地没有存档时使用的初始站点 */
const SEED_STATIONS: Array<Omit<Station, "id" | "createdAt">> = [
  {
    station: "东区一站",
    area: "东区",
    stock: 36000,
    manager: "刘站长",
    status: "营业中",
    notes: "库存正常"
  },
  {
    station: "机场快线站",
    area: "机场线",
    stock: 9000,
    manager: "王站长",
    status: "库存紧张",
    notes: "柴油待补"
  }
];

function withSeed(): Station[] {
  return SEED_STATIONS.map((record, index) => ({
    ...record,
    id: `seed-${index + 1}`,
    createdAt: new Date(Date.now() - index * 86400000).toISOString()
  }));
}

function loadStations(): Station[] {
  const raw = localStorage.getItem(STATION_KEY);
  if (!raw) return withSeed();
  try {
    const parsed = JSON.parse(raw) as Station[];
    // 旧版本存档没有 freeze 字段，补齐后再使用
    return parsed.map((station) => ({ ...station, freeze: station.freeze }));
  } catch {
    return [];
  }
}

function loadSessions(): CountSession[] {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as CountSession[];
  } catch {
    return [];
  }
}

const stations = ref<Station[]>(loadStations());
const sessions = ref<CountSession[]>(loadSessions());

function persistStations() {
  localStorage.setItem(STATION_KEY, JSON.stringify(stations.value));
}

function persistSessions() {
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessions.value));
}

export type StartResult =
  | { ok: true; session: CountSession }
  | { ok: false; message: string };

export type ReviewResult =
  | { ok: true; outcome: CountOutcome }
  | { ok: false; message: string };

export function useInventoryStore() {
  const frozenCount = computed(
    () => stations.value.filter((station) => station.status === "盘点冻结").length
  );
  const pendingCount = computed(
    () => sessions.value.filter((session) => session.outcome === "待复核").length
  );

  function addStation(input: NewStation) {
    stations.value = [
      {
        ...input,
        id: crypto.randomUUID(),
        status: "营业中",
        createdAt: new Date().toISOString()
      },
      ...stations.value
    ];
    persistStations();
  }

  /** 人工流转：冻结站点不允许流转 */
  function flowStatus(station: Station): ManualStatus | null {
    if (station.status === "盘点冻结") return null;
    const index = MANUAL_STATUSES.indexOf(station.status);
    const next = MANUAL_STATUSES[(index + 1) % MANUAL_STATUSES.length];
    station.status = next;
    persistStations();
    return next;
  }

  /** 移出：冻结站点不允许删除 */
  function removeStation(id: string): boolean {
    const station = stations.value.find((item) => item.id === id);
    if (!station) return false;
    if (station.status === "盘点冻结") return false;
    stations.value = stations.value.filter((item) => item.id !== id);
    persistStations();
    return true;
  }

  /**
   * 营业中站点录入实盘量发起盘点：
   * - 差异 <= 3%：直接更新库存并确定目标状态，盘点单归档为“已自动更新”
   * - 差异 > 3%：保留原库存进入盘点冻结，盘点单“待复核”，等待另一名人员处理
   */
  function startCount(
    stationId: string,
    actualStock: number,
    counter: string
  ): StartResult {
    const station = stations.value.find((item) => item.id === stationId);
    if (!station) return { ok: false, message: "站点不存在" };
    if (station.status === "盘点冻结") {
      return { ok: false, message: "站点已在盘点冻结中，不能重复发起" };
    }
    if (station.status !== "营业中") {
      return { ok: false, message: "仅营业中的站点可以发起盘点" };
    }
    if (!Number.isFinite(actualStock) || actualStock < 0) {
      return { ok: false, message: "请输入有效的实盘量" };
    }
    if (!counter.trim()) {
      return { ok: false, message: "请填写盘点人" };
    }

    const bookStock = Number(station.stock) || 0;
    const ratio = diffPercent(bookStock, actualStock);
    const now = new Date().toISOString();
    const session: CountSession = {
      id: crypto.randomUUID(),
      stationId: station.id,
      stationName: station.station,
      area: station.area,
      counter: counter.trim(),
      bookStock,
      actualStock,
      diffRatio: Number(ratio.toFixed(2)),
      startedAt: now,
      outcome: "待复核"
    };

    if (ratio <= DIFF_LIMIT_PERCENT) {
      station.stock = actualStock;
      station.status = targetStatus(actualStock);
      station.freeze = undefined;
      session.outcome = "已自动更新";
      session.reviewedAt = now;
    } else {
      // 保留原库存与原状态，仅切换为冻结并留存快照
      station.status = "盘点冻结";
      station.freeze = {
        sessionId: session.id,
        previousStatus: "营业中",
        bookStock,
        actualStock,
        counter: session.counter,
        frozenAt: now
      };
    }

    sessions.value = [session, ...sessions.value];
    persistStations();
    persistSessions();
    return { ok: true, session };
  }

  /**
   * 另一名人员复核冻结中的盘点单
   * approve=true 放行：按实盘量更新库存并恢复营业/转紧张
   * approve=false 退回：恢复盘点前的原状态与原账面库存
   */
  function reviewCount(
    stationId: string,
    reviewer: string,
    approve: boolean
  ): ReviewResult {
    const station = stations.value.find((item) => item.id === stationId);
    if (!station) return { ok: false, message: "站点不存在" };
    if (station.status !== "盘点冻结" || !station.freeze) {
      return { ok: false, message: "该站点没有待复核的盘点单" };
    }
    if (!reviewer.trim()) return { ok: false, message: "请填写复核人" };

    const freeze = station.freeze;
    if (reviewer.trim() === freeze.counter) {
      return { ok: false, message: "复核人必须由另一名人员担任，不能与盘点人为同一人" };
    }

    const session = sessions.value.find((item) => item.id === freeze.sessionId);
    const reviewedAt = new Date().toISOString();

    if (approve) {
      station.stock = freeze.actualStock;
      station.status = targetStatus(freeze.actualStock);
      station.freeze = undefined;
      if (session) {
        session.outcome = "放行";
        session.reviewer = reviewer.trim();
        session.reviewedAt = reviewedAt;
      }
    } else {
      // 退回：还原原状态与原库存
      station.stock = freeze.bookStock;
      const status: StationStatus = freeze.previousStatus;
      station.status = status;
      station.freeze = undefined;
      if (session) {
        session.outcome = "退回";
        session.reviewer = reviewer.trim();
        session.reviewedAt = reviewedAt;
      }
    }

    persistStations();
    persistSessions();
    return { ok: true, outcome: approve ? "放行" : "退回" };
  }

  return {
    stations,
    sessions,
    frozenCount,
    pendingCount,
    lowStockThreshold: LOW_STOCK_LITERS,
    addStation,
    flowStatus,
    removeStation,
    startCount,
    reviewCount
  };
}
