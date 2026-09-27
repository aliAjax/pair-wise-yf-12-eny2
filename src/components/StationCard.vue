<script setup lang="ts">
import { computed, ref } from "vue";
import {
  canReview,
  formatDiffPct,
  isFrozen,
  latestStocktake,
  pendingStocktake,
  STOCKTAKE_STATE_LABELS,
  type RecordItem
} from "../inventoryRules";

type FieldView = {
  key: string;
  label: string;
};

const props = defineProps<{
  record: RecordItem;
  fields: readonly FieldView[];
  title: string;
}>();

const emit = defineEmits<{
  flow: [record: RecordItem];
  remove: [id: string];
  copy: [record: RecordItem];
  startStocktake: [record: RecordItem, actual: number, countedBy: string];
  approve: [record: RecordItem, reviewedBy: string];
  reject: [record: RecordItem, reviewedBy: string];
}>();

const counting = ref(false);
const actualInput = ref<number | null>(null);
const countedByInput = ref("");
const reviewerInput = ref("");

const frozen = computed(() => isFrozen(props.record));
const pending = computed(() => pendingStocktake(props.record));
const latest = computed(() => latestStocktake(props.record));

const actualValid = computed(
  () => actualInput.value !== null && Number.isFinite(actualInput.value) && actualInput.value >= 0
);
const canSubmitCount = computed(() => actualValid.value && countedByInput.value.trim().length > 0);
const reviewerValid = computed(() =>
  pending.value ? canReview(pending.value, reviewerInput.value) : false
);

function submitCount() {
  if (!canSubmitCount.value || actualInput.value === null) return;
  emit("startStocktake", props.record, actualInput.value, countedByInput.value.trim());
  counting.value = false;
  actualInput.value = null;
  countedByInput.value = "";
}

function review(action: "approve" | "reject") {
  if (!reviewerValid.value) return;
  emit(action, props.record, reviewerInput.value.trim());
  reviewerInput.value = "";
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString();
}
</script>

<template>
  <article class="record" :class="{ frozen }">
    <div class="record-head">
      <p class="record-title">{{ title }}</p>
      <span class="status" :class="{ 'status-frozen': frozen }">{{ record.status }}</span>
    </div>
    <div class="details">
      <span v-for="field in fields" :key="field.key">{{ field.label }}: {{ record[field.key] }}</span>
    </div>
    <p class="note">{{ record.notes }}</p>

    <section v-if="latest" class="stocktake">
      <header class="stocktake-head">
        <strong>盘点台账</strong>
        <span class="stocktake-state" :data-state="latest.state">
          {{ STOCKTAKE_STATE_LABELS[latest.state] }}
        </span>
      </header>
      <div class="stocktake-grid">
        <span>账面库存: {{ latest.bookStock }} L</span>
        <span>实盘量: {{ latest.actualStock }} L</span>
        <span>差异: {{ latest.diff > 0 ? "+" : "" }}{{ latest.diff }} L</span>
        <span>差异率: {{ formatDiffPct(latest) }}</span>
        <span>盘点人: {{ latest.countedBy }}</span>
        <span>盘点时间: {{ formatTime(latest.countedAt) }}</span>
        <template v-if="latest.reviewedBy">
          <span>复核人: {{ latest.reviewedBy }}</span>
          <span>复核时间: {{ formatTime(latest.reviewedAt || "") }}</span>
        </template>
      </div>

      <div v-if="pending" class="review-box">
        <p class="hint">差异超过 3%,已保留原库存,须由另一名人员复核放行或退回。</p>
        <div class="review-row">
          <input v-model="reviewerInput" placeholder="复核人姓名(不能是盘点人)" />
          <button type="button" :disabled="!reviewerValid" @click="review('approve')">放行</button>
          <button class="danger" type="button" :disabled="!reviewerValid" @click="review('reject')">退回</button>
        </div>
      </div>
    </section>

    <section v-else-if="counting" class="stocktake">
      <header class="stocktake-head"><strong>填写实盘量</strong></header>
      <div class="review-row">
        <input v-model.number="actualInput" type="number" min="0" placeholder="实盘量(L)" />
        <input v-model="countedByInput" placeholder="盘点人姓名" />
        <button type="button" :disabled="!canSubmitCount" @click="submitCount">提交盘点</button>
        <button class="secondary" type="button" @click="counting = false">取消</button>
      </div>
    </section>

    <p v-if="frozen" class="hint">盘点冻结中,复核前不能流转或移出。</p>

    <div class="actions">
      <button type="button" :disabled="frozen" @click="emit('flow', record)">流转状态</button>
      <button
        v-if="record.status === '营业中' && !counting"
        type="button"
        @click="counting = true"
      >
        {{ latest ? "再次盘点" : "盘点" }}
      </button>
      <button class="secondary" type="button" @click="emit('copy', record)">复制摘要</button>
      <button class="danger" type="button" :disabled="frozen" @click="emit('remove', record.id)">删除</button>
    </div>
  </article>
</template>
