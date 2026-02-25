<template>
  <section class="panel">
    <header class="panel__header">
      <h3>车间信息</h3>
      <span :class="['status-dot', `status-dot--${workshop.status}`]">
        {{ statusText }}
      </span>
    </header>
    <div class="panel__body">
      <p class="name">{{ workshop.name }}</p>
      <p class="description">{{ workshop.description }}</p>
      <ul class="metric-list">
        <li><label>建筑面积</label><strong>{{ workshop.areaM2.toLocaleString() }} m²</strong></li>
        <li><label>负责人</label><strong>{{ workshop.manager }}</strong></li>
        <li><label>关联仓库</label><strong>{{ workshop.relatedWarehouseCount }} 个</strong></li>
        <li><label>在岗人数</label><strong>{{ workshop.staffCount }} 人</strong></li>
        <li><label>库存总量</label><strong>{{ workshop.kpi.inventoryTons.toLocaleString() }} 吨</strong></li>
        <li><label>库存金额</label><strong>{{ workshop.kpi.inventoryAmountWan.toLocaleString() }} 万元</strong></li>
        <li><label>周转率</label><strong>{{ workshop.kpi.turnoverRate.toFixed(1) }} 次/月</strong></li>
        <li><label>呆滞率</label><strong>{{ workshop.kpi.stagnantRate.toFixed(1) }} %</strong></li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { STATUS_TEXT_MAP } from "@/mock/workshops";
import type { WorkshopInfo } from "@/types/workshop";

interface Props {
  workshop: WorkshopInfo;
}

const props = defineProps<Props>();

const statusText = computed(() => STATUS_TEXT_MAP[props.workshop.status]);
</script>

<style scoped>
.panel {
  height: 100%;
  background: var(--panel-bg);
  border: var(--panel-border);
  border-radius: var(--panel-radius);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: fadeSlideUp 0.4s ease-out 0.05s both;
}

.panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-default);
}

h3 {
  margin: 0;
  font-size: 16px;
  letter-spacing: 1px;
  color: var(--c-primary);
}

.panel__body {
  padding: 12px 16px 16px;
  overflow: auto;
}

.name {
  margin: 0;
  color: var(--text-primary);
  font-size: 20px;
  font-weight: 700;
}

.description {
  margin: 8px 0 12px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.5;
}

.metric-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.metric-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 12px;
  background: var(--bg-inset);
  border: 1px solid var(--border-default);
  border-radius: 6px;
  gap: 10px;
  transition: background 0.2s ease;
}

.metric-list li:hover {
  background: var(--bg-card-hover);
}

.metric-list label {
  color: var(--text-secondary);
  font-size: 13px;
}

.metric-list strong {
  color: var(--c-primary);
  font-size: 14px;
}

.status-dot {
  font-size: 12px;
  border: 1px solid currentColor;
  border-radius: 4px;
  padding: 3px 10px;
}

.status-dot--normal {
  color: var(--c-green);
}

.status-dot--busy {
  color: var(--c-orange);
}

.status-dot--warning {
  color: var(--c-red);
}
</style>
