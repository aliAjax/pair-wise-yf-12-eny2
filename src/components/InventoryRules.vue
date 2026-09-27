<script setup lang="ts">
import { COUNT_RULES, DIFF_LIMIT_PERCENT, LOW_STOCK_LITERS } from "../inventory/rules";
</script>

<template>
  <section class="panel rules-panel">
    <div class="toolbar">
      <h2>盘点规则</h2>
      <span class="rule-threshold">阈值 {{ DIFF_LIMIT_PERCENT }}% / {{ LOW_STOCK_LITERS.toLocaleString("zh-CN") }} L</span>
    </div>
    <ol class="rule-list">
      <li v-for="rule in COUNT_RULES" :key="rule.title">
        <strong>{{ rule.title }}</strong>
        <p>{{ rule.detail }}</p>
      </li>
    </ol>
    <p class="rule-foot">规则说明独立于站点卡片与本地存档，盘点提交前后、复核前后均可随时查看。</p>
  </section>
</template>
