<script setup lang="ts">
import { computed, ref } from "vue";
import type { CountOutcome } from "../inventory/types";
import { formatLiters, formatRatio, formatTime } from "../inventory/format";

const props = defineProps<{
  sessions: Array<{
    id: string;
    stationName: string;
    area: string;
    counter: string;
    bookStock: number;
    actualStock: number;
    diffRatio: number;
    startedAt: string;
    outcome: CountOutcome;
    reviewer?: string;
    reviewedAt?: string;
  }>;
}>();

const outcomeFilters = ["全部", "待复核", "已自动更新", "放行", "退回"] as const;
const filter = ref<(typeof outcomeFilters)[number]>("全部");

const rows = computed(() => {
  if (filter.value === "全部") return props.sessions;
  return props.sessions.filter((session) => session.outcome === filter.value);
});
</script>

<template>
  <section class="panel archive-panel">
    <div class="toolbar">
      <h2>盘点台账（本地存档）</h2>
      <select v-model="filter">
        <option v-for="item in outcomeFilters" :key="item">{{ item }}</option>
      </select>
    </div>
    <p class="archive-tip">盘点单在提交时即写入本地存档，待复核与已复核记录均可查看。</p>

    <div v-if="rows.length === 0" class="empty">暂无盘点记录</div>
    <div v-else class="session-list">
      <article v-for="session in rows" :key="session.id" class="session">
        <div class="session-head">
          <p class="session-title">{{ session.stationName }} · {{ session.area }}</p>
          <span class="outcome" :class="`outcome-${session.outcome}`">{{ session.outcome }}</span>
        </div>
        <div class="session-grid">
          <span>账面库存：{{ formatLiters(session.bookStock) }}</span>
          <span>实盘量：{{ formatLiters(session.actualStock) }}</span>
          <span>差异：{{ formatRatio(session.diffRatio) }}</span>
          <span>盘点人：{{ session.counter }}</span>
          <span>提交时间：{{ formatTime(session.startedAt) }}</span>
          <span v-if="session.reviewer">复核人：{{ session.reviewer }}</span>
          <span v-if="session.reviewedAt">复核时间：{{ formatTime(session.reviewedAt) }}</span>
        </div>
      </article>
    </div>
  </section>
</template>
