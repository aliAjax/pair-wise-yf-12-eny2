<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import StationCard from "./components/StationCard.vue";
import InventoryRules from "./components/InventoryRules.vue";
import CountArchive from "./components/CountArchive.vue";
import { useInventoryStore } from "./inventory/store";
import type { StationStatus } from "./inventory/types";

const AREAS = ["东区", "西区", "机场线"] as const;
const AREA_FILTERS = ["全部区域", ...AREAS] as const;

const {
  stations,
  sessions,
  pendingCount,
  addStation,
  flowStatus,
  removeStation
} = useInventoryStore();

const form = reactive({
  station: "",
  area: "",
  stock: 0,
  manager: ""
});
const note = ref("");
const areaFilter = ref<(typeof AREA_FILTERS)[number]>(AREA_FILTERS[0]);
const counterName = ref("");

type Tab = "rules" | "ledger" | "archive";
const activeTab = ref<Tab>("ledger");
const tabs: Array<{ key: Tab; label: string }> = [
  { key: "rules", label: "盘点规则" },
  { key: "ledger", label: "站点台账" },
  { key: "archive", label: "本地存档" }
];

const filteredStations = computed(() => {
  if (areaFilter.value.startsWith("全部")) return stations.value;
  return stations.value.filter((station) => station.area === areaFilter.value);
});

const statusChart: Array<{ status: StationStatus }> = [
  { status: "营业中" },
  { status: "暂停营业" },
  { status: "库存紧张" },
  { status: "盘点冻结" }
];

const chartRows = computed(() =>
  statusChart.map(({ status }) => ({
    status,
    value: stations.value.filter((station) => station.status === status).length
  }))
);
const maxChart = computed(() => Math.max(1, ...chartRows.value.map((row) => row.value)));

const metrics = computed(() => [
  stations.value.length,
  stations.value.filter((station) => station.status === "营业中").length,
  stations.value.filter((station) => station.status === "库存紧张").length,
  stations.value.filter((station) => station.status === "盘点冻结").length
]);
const metricLabels = ["油站数", "营业中", "库存紧张", "盘点冻结"];

function submitStation() {
  addStation({
    station: form.station,
    area: form.area,
    stock: Number(form.stock) || 0,
    manager: form.manager,
    notes: note.value || "暂无备注"
  });
  form.station = "";
  form.area = "";
  form.stock = 0;
  form.manager = "";
  note.value = "";
}

function onFlow(id: string) {
  flowStatus(stations.value.find((station) => station.id === id)!);
}

function onRemove(id: string) {
  removeStation(id);
}

</script>

<template>
  <main class="app">
    <div class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">石油行业前端最小闭环</p>
          <h1>油站网点盘点台账</h1>
          <p class="subtitle">
            营业中站点录入实盘量后进入盘点冻结，冻结期间不能流转或移出；差异不超 3% 直接更新，超差异由另一名人员放行或退回。
          </p>
        </div>
        <div class="stack">
          <span class="tag">Vue3</span>
          <span class="tag">Vite</span>
          <span class="tag">TypeScript</span>
          <span class="tag">localStorage</span>
        </div>
      </header>

      <section class="metrics">
        <article v-for="(label, index) in metricLabels" :key="label" class="metric">
          <span>{{ label }}</span>
          <strong>{{ metrics[index] }}</strong>
        </article>
      </section>

      <nav class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          class="tab"
          :class="{ 'tab-active': activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
          <span v-if="tab.key === 'archive' && pendingCount > 0" class="tab-badge">{{ pendingCount }}</span>
        </button>
      </nav>

      <!-- 盘点规则：独立承载，复核前后均可查看 -->
      <InventoryRules v-if="activeTab === 'rules'" />

      <!-- 本地存档：与规则、卡片分开承载，复核前后均可查看 -->
      <CountArchive v-else-if="activeTab === 'archive'" :sessions="sessions" />

      <!-- 站点台账：列表卡片承载实盘录入、冻结与复核操作 -->
      <section v-else class="workspace">
        <form class="panel" @submit.prevent="submitStation">
          <h2>新增油站</h2>
          <div class="form-grid">
            <label>
              油站名称
              <input v-model="form.station" required />
            </label>
            <label>
              区域
              <select v-model="form.area" required>
                <option value="">请选择</option>
                <option v-for="area in AREAS" :key="area">{{ area }}</option>
              </select>
            </label>
            <label>
              账面库存（L）
              <input v-model.number="form.stock" type="number" min="0" step="100" required />
            </label>
            <label>
              负责人
              <input v-model="form.manager" required />
            </label>
            <label>
              备注
              <textarea v-model="note" placeholder="填写处理说明或现场备注" />
            </label>
            <button type="submit">保存油站</button>
          </div>
        </form>

        <section class="list-panel">
          <div class="toolbar ledger-toolbar">
            <h2>油站列表</h2>
            <div class="toolbar-controls">
              <label class="counter-input">
                本次盘点人
                <input v-model="counterName" type="text" placeholder="发起盘点前填写" />
              </label>
              <select v-model="areaFilter">
                <option v-for="item in AREA_FILTERS" :key="item">{{ item }}</option>
              </select>
            </div>
          </div>

          <div class="record-grid">
            <div v-if="filteredStations.length === 0" class="empty">暂无匹配数据</div>
            <StationCard
              v-for="station in filteredStations"
              :key="station.id"
              :station="station"
              :counter-name="counterName"
              @flow="onFlow"
              @remove="onRemove"
            />
          </div>

          <div class="mini-chart">
            <div v-for="row in chartRows" :key="row.status" class="bar">
              <span>{{ row.status }}</span>
              <div class="bar-track"><div class="bar-fill" :style="{ width: `${(row.value / maxChart) * 100}%` }" /></div>
              <strong>{{ row.value }}</strong>
            </div>
          </div>
        </section>
      </section>
    </div>
  </main>
</template>
