# 油站网点盘点台账

- 行业：石油
- 技术栈：Vue3、Vite、TypeScript、Element Plus、localStorage
- 启动：`npm install && npm run dev`
- 构建：`npm run build`

## 盘点流程

1. 仅「营业中」站点可在卡片上填写实盘量（需先在列表顶部填写本次盘点人）并提交盘点。
2. 实盘量与账面库存差异 **不超过 3%**：直接按实盘量更新库存；实盘量少于 10,000 L 转为「库存紧张」，否则恢复「营业中」。
3. 差异 **超过 3%**：保留原账面库存，站点进入「盘点冻结」，期间不能流转状态或移出，等待另一名人员（不得与盘点人为同一人）复核：
   - **放行**：按实盘量更新库存，少于 10,000 L 转「库存紧张」，否则恢复「营业中」。
   - **退回**：恢复盘点前的原状态与原库存。
4. 盘点单在提交时即写入本地存档，「待复核」与复核结果均可在「本地存档」页查看。

## 代码结构（规则、卡片、存档分开承载）

- `src/inventory/rules.ts`：盘点规则常量与差异/目标状态计算
- `src/inventory/store.ts`：站点与盘点单状态、localStorage 持久化、发起/复核逻辑
- `src/components/StationCard.vue`：站点列表卡片（实盘录入、冻结、放行/退回）
- `src/components/InventoryRules.vue`：盘点规则页，复核前后均可查看
- `src/components/CountArchive.vue`：盘点台账本地存档页，独立 localStorage 键
- 站点数据键：`hxwlfront-21-station-map`；盘点单键：`hxwlfront-21-count-sessions`
