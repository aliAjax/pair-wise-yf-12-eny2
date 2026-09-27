<script setup lang="ts">
import { computed, ref } from "vue";
import { DIFF_LIMIT_PERCENT, LOW_STOCK_LITERS, diffPercent } from "../inventory/rules";
import { useInventoryStore } from "../inventory/store";
import { formatLiters, formatRatio, formatTime } from "../inventory/format";
import type { Station } from "../inventory/types";

const props = defineProps<{
  station: Station;
  counterName: string;
}>();

const emit = defineEmits<{
  flow: [id: string];
  remove: [id: string];
}>();

const { startCount, reviewCount } = useInventoryStore();

const actualInput = ref<number | null>(null);
const reviewerName = ref("");
const message = ref<{ tone: "ok" | "error"; text: string } | null>(null);

const frozen = computed(() => props.station.status === "盘点冻结" && props.station.freeze);

const previewRatio = computed(() => {
  if (actualInput.value === null || Number.isNaN(actualInput.value)) return null;
  return diffPercent(Number(props.station.stock) || 0, actualInput.value);
});

const previewWithinLimit = computed(
  () => previewRatio.value !== null && previewRatio.value <= DIFF_LIMIT_PERCENT
);

const statusClass = computed(() => {
  switch (props.station.status) {
    case "盘点冻结":
      return "status status-frozen";
    case "库存紧张":
      return "status status-low";
    case "暂停营业":
      return "status status-paused";
    default:
      return "status";
  }
});

function showMessage(tone: "ok" | "error", text: string) {
  message.value = { tone, text };
}

function submitCount() {
  if (actualInput.value === null || Number.isNaN(actualInput.value)) {
    showMessage("error", "请填写实盘量");
    return;
  }
  const result = startCount(props.station.id, actualInput.value, props.counterName);
  if (!result.ok) {
    showMessage("error", result.message);
    return;
  }
  actualInput.value = null;
  if (result.session.outcome === "已自动更新") {
    showMessage("ok", "差异未超阈值，已按实盘量更新库存并写入盘点台账");
  } else {
    showMessage("ok", "已进入盘点冻结，库存保持不变，等待另一名人员复核放行");
  }
}

function approve() {
  const result = reviewCount(props.station.id, reviewerName.value, true);
  if (!result.ok) {
    showMessage("error", result.message);
    return;
  }
  reviewerName.value = "";
  showMessage("ok", "已放行，库存按实盘量更新");
}

function reject() {
  const result = reviewCount(props.station.id, reviewerName.value, false);
  if (!result.ok) {
    showMessage("error", result.message);
    return;
  }
  reviewerName.value = "";
  showMessage("ok", "已退回，站点恢复原状态与原库存");
}

async function copySummary() {
  const text = `${props.station.station} / ${props.station.area} / 账面 ${formatLiters(
    Number(props.station.stock)
  )}`;
  await navigator.clipboard?.writeText(text);
}
</script>

<template>
  <article class="record">
    <div class="record-head">
      <p class="record-title">{{ station.station }}</p>
      <span :class="statusClass">{{ station.status }}</span>
    </div>

    <div class="details">
      <span>区域: {{ station.area }}</span>
      <span>负责人: {{ station.manager }}</span>
      <span>账面库存: {{ formatLiters(Number(station.stock)) }}</span>
      <span>建档时间: {{ formatTime(station.createdAt) }}</span>
    </div>

    <p class="note">{{ station.notes }}</p>

    <!-- 营业中：录入实盘量后进入盘点冻结（差异不超阈值则当场自动更新） -->
    <div v-if="station.status === '营业中'" class="count-box">
      <div class="count-row">
        <label class="count-field">
          实盘量（L）
          <input v-model.number="actualInput" type="number" min="0" step="100" placeholder="填写现场实盘量" />
        </label>
        <button type="button" :disabled="!counterName.trim()" @click="submitCount">
          提交盘点
        </button>
      </div>
      <p v-if="!counterName.trim()" class="count-hint">请先在顶部填写本次盘点人</p>
      <p
        v-else-if="previewRatio !== null"
        class="count-hint"
        :class="previewWithinLimit ? 'hint-ok' : 'hint-warn'"
      >
        预计差异 {{ formatRatio(previewRatio) }}：
        <template v-if="previewWithinLimit">
          不超过 {{ DIFF_LIMIT_PERCENT }}%，提交后直接更新库存
          <template v-if="Number(actualInput) < LOW_STOCK_LITERS">并转为库存紧张</template>
        </template>
        <template v-else>超过 {{ DIFF_LIMIT_PERCENT }}%，提交后进入盘点冻结，等待另一名人员放行</template>
      </p>
    </div>

    <!-- 盘点冻结：不能流转或移出，只能由另一名人员放行 / 退回 -->
    <div v-else-if="frozen && station.freeze" class="freeze-box">
      <div class="freeze-grid">
        <span>账面库存：{{ formatLiters(station.freeze.bookStock) }}</span>
        <span>实盘量：{{ formatLiters(station.freeze.actualStock) }}</span>
        <span>
          差异：{{ formatRatio(diffPercent(station.freeze.bookStock, station.freeze.actualStock)) }}
          （超过 {{ DIFF_LIMIT_PERCENT }}%）
        </span>
        <span>盘点人：{{ station.freeze.counter }}</span>
        <span>冻结时间：{{ formatTime(station.freeze.frozenAt) }}</span>
        <span>原状态：{{ station.freeze.previousStatus }}</span>
      </div>
      <div class="review-row">
        <label class="review-field">
          复核人（需为另一名人员）
          <input v-model="reviewerName" type="text" placeholder="填写复核人姓名" />
        </label>
        <button type="button" @click="approve">放行并更新</button>
        <button class="danger" type="button" @click="reject">退回</button>
      </div>
    </div>

    <p v-if="message" class="count-message" :class="message.tone === 'ok' ? 'msg-ok' : 'msg-error'">
      {{ message.text }}
    </p>

    <div class="actions">
      <button
        type="button"
        :disabled="station.status === '盘点冻结'"
        :title="station.status === '盘点冻结' ? '盘点冻结期间不能流转' : ''"
        @click="emit('flow', station.id)"
      >
        流转状态
      </button>
      <button class="secondary" type="button" @click="copySummary">复制摘要</button>
      <button
        class="danger"
        type="button"
        :disabled="station.status === '盘点冻结'"
        :title="station.status === '盘点冻结' ? '盘点冻结期间不能移出' : ''"
        @click="emit('remove', station.id)"
      >
        移出
      </button>
    </div>
  </article>
</template>
