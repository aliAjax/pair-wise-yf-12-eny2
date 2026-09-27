<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import StationCard from "./components/StationCard.vue";
import {
  FROZEN_STATUS,
  isFrozen,
  isWithinTolerance,
  makeStocktake,
  pendingStocktake,
  statusAfterUpdate,
  type RecordItem
} from "./inventoryRules";
import { loadRecords, saveRecords } from "./storage";

type Field = {
  key: string;
  label: string;
  type?: "number" | "date" | "select";
  options?: readonly string[];
};

const project = {
  "number": 21,
  "folder": "hxwl/frontend/hxwlfront-21",
  "framework": "vue",
  "title": "油站网点地图管理",
  "subtitle": "维护油站位置、营业状态和库存摘要。",
  "industry": "石油",
  "stack": [
    "Vue3",
    "Vite",
    "TypeScript",
    "Element Plus",
    "Leaflet"
  ],
  "storageKey": "hxwlfront-21-station-map",
  "formTitle": "新增油站",
  "primaryAction": "保存油站",
  "entityLabel": "油站",
  "statuses": [
    "营业中",
    "暂停营业",
    "库存紧张"
  ],
  "filters": [
    "全部区域",
    "东区",
    "西区",
    "机场线"
  ],
  "fields": [
    {
      "key": "station",
      "label": "油站名称"
    },
    {
      "key": "area",
      "label": "区域",
      "type": "select",
      "options": [
        "东区",
        "西区",
        "机场线"
      ]
    },
    {
      "key": "stock",
      "label": "库存摘要L",
      "type": "number"
    },
    {
      "key": "manager",
      "label": "负责人"
    }
  ],
  "records": [
    {
      "station": "东区一站",
      "area": "东区",
      "stock": 36000,
      "manager": "刘站长",
      "status": "营业中",
      "notes": "库存正常"
    },
    {
      "station": "机场快线站",
      "area": "机场线",
      "stock": 9000,
      "manager": "王站长",
      "status": "库存紧张",
      "notes": "柴油待补"
    }
  ],
  "metricLabels": [
    "油站数",
    "营业中",
    "库存紧张",
    "盘点冻结"
  ]
} as const;

const fields = project.fields as readonly Field[];
const statuses = [...project.statuses];

function createBlank() {
  return Object.fromEntries(fields.map((field) => [field.key, field.type === "number" ? 0 : ""]));
}

function seedRecords(): RecordItem[] {
  return project.records.map((record, index) => ({
    ...record,
    id: `seed-${index + 1}`,
    createdAt: new Date(Date.now() - index * 86400000).toISOString()
  })) as RecordItem[];
}

const records = ref<RecordItem[]>(loadRecords(project.storageKey, seedRecords));
const form = reactive<Record<string, string | number>>(createBlank());
const note = ref("");
const filter = ref(project.filters[0]);

const filteredRecords = computed(() => {
  if (filter.value.startsWith("全部")) return records.value;
  return records.value.filter((record) => Object.values(record).includes(filter.value));
});

const metrics = computed(() =>
  project.metricLabels.map((label) =>
    label === "油站数"
      ? records.value.length
      : records.value.filter((record) => record.status === label).length
  )
);

const chartRows = computed(() =>
  [...statuses, FROZEN_STATUS].map((status) => ({
    status,
    value: records.value.filter((record) => record.status === status).length
  }))
);

const maxChart = computed(() => Math.max(1, ...chartRows.value.map((row) => row.value)));

function persist() {
  saveRecords(project.storageKey, records.value);
}

function nextStatus(status: string) {
  const index = statuses.indexOf(status);
  return statuses[(index + 1) % statuses.length];
}

function primaryText(record: RecordItem) {
  const first = fields[0];
  const second = fields[1];
  return [record[first.key], record[second.key]].filter(Boolean).join(" / ") || project.entityLabel;
}

function submit() {
  records.value = [
    {
      ...form,
      id: crypto.randomUUID(),
      status: statuses[0],
      notes: note.value || "暂无备注",
      createdAt: new Date().toISOString()
    } as RecordItem,
    ...records.value
  ];
  Object.assign(form, createBlank());
  note.value = "";
  persist();
}

function flow(record: RecordItem) {
  if (isFrozen(record)) return; // 盘点冻结期间不能流转
  record.status = nextStatus(record.status);
  persist();
}

function remove(id: string) {
  const target = records.value.find((record) => record.id === id);
  if (target && isFrozen(target)) return; // 盘点冻结期间不能移出
  records.value = records.value.filter((record) => record.id !== id);
  persist();
}

// 营业中的站点填写实盘量后进入盘点冻结;差异不超过 3% 直接更新
function startStocktake(record: RecordItem, actual: number, countedBy: string) {
  if (record.status !== "营业中" || isFrozen(record)) return;
  const entry = makeStocktake(actual, Number(record.stock) || 0, countedBy, record.status);
  record.stocktakes = [...(record.stocktakes ?? []), entry];
  if (isWithinTolerance(entry)) {
    entry.state = "auto-applied";
    record.stock = entry.actualStock;
    record.status = statusAfterUpdate(entry.actualStock);
  } else {
    record.status = FROZEN_STATUS;
  }
  persist();
}

// 另一名人员放行:按实盘更新库存,并按一万升线判定状态
function approveStocktake(record: RecordItem, reviewedBy: string) {
  const entry = pendingStocktake(record);
  if (!entry) return;
  entry.state = "approved";
  entry.reviewedBy = reviewedBy;
  entry.reviewedAt = new Date().toISOString();
  record.stock = entry.actualStock;
  record.status = statusAfterUpdate(entry.actualStock);
  persist();
}

// 退回:恢复原来的状态和库存
function rejectStocktake(record: RecordItem, reviewedBy: string) {
  const entry = pendingStocktake(record);
  if (!entry) return;
  entry.state = "rejected";
  entry.reviewedBy = reviewedBy;
  entry.reviewedAt = new Date().toISOString();
  record.stock = entry.bookStock;
  record.status = entry.previousStatus;
  persist();
}
</script>

<template>
  <main class="app">
    <div class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">{{ project.industry }}行业前端最小闭环</p>
          <h1>{{ project.title }}</h1>
          <p class="subtitle">{{ project.subtitle }}</p>
        </div>
        <div class="stack">
          <span v-for="item in project.stack" :key="item" class="tag">{{ item }}</span>
        </div>
      </header>

      <section class="metrics">
        <article v-for="(label, index) in project.metricLabels" :key="label" class="metric">
          <span>{{ label }}</span>
          <strong>{{ metrics[index] }}</strong>
        </article>
      </section>

      <section class="workspace">
        <form class="panel" @submit.prevent="submit">
          <h2>{{ project.formTitle }}</h2>
          <div class="form-grid">
            <label v-for="field in fields" :key="field.key">
              {{ field.label }}
              <select v-if="field.type === 'select'" v-model="form[field.key]" required>
                <option value="">请选择</option>
                <option v-for="option in field.options" :key="option">{{ option }}</option>
              </select>
              <input v-else v-model="form[field.key]" :type="field.type || 'text'" required />
            </label>
            <label>
              备注
              <textarea v-model="note" placeholder="填写处理说明或现场备注" />
            </label>
            <button type="submit">{{ project.primaryAction }}</button>
          </div>
        </form>

        <section class="list-panel">
          <div class="toolbar">
            <h2>{{ project.entityLabel }}列表</h2>
            <select v-model="filter">
              <option v-for="item in project.filters" :key="item">{{ item }}</option>
            </select>
          </div>

          <div class="record-grid">
            <div v-if="filteredRecords.length === 0" class="empty">暂无匹配数据</div>
            <StationCard
              v-for="record in filteredRecords"
              :key="record.id"
              :record="record"
              :fields="fields"
              :title="primaryText(record)"
              @flow="flow"
              @remove="remove"
              @copy="(target) => navigator.clipboard?.writeText(primaryText(target))"
              @start-stocktake="startStocktake"
              @approve="approveStocktake"
              @reject="rejectStocktake"
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
