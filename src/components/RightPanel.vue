<template>
  <section class="panel">
    <header class="panel__header">
      <div class="tabs">
        <button
          v-for="item in tabItems"
          :key="item.key"
          :class="{ active: activeTab === item.key }"
          @click="activeTab = item.key"
        >
          {{ item.label }}
        </button>
      </div>
      <span class="seed-tag">种子：{{ seedInfo.seed }}</span>
    </header>

    <div class="panel__body">
      <div v-if="activeTab === 'detail'" class="detail-tab">
        <h3>{{ workshop.name }}</h3>
        <p class="desc">{{ workshop.description }}</p>
        <ul class="kv-list">
          <li><label>负责人</label><span>{{ workshop.manager }}</span></li>
          <li><label>面积</label><span>{{ workshop.areaM2.toLocaleString() }} 平方米</span></li>
          <li><label>仓库数</label><span>{{ workshop.relatedWarehouseCount }}</span></li>
          <li><label>在岗人数</label><span>{{ workshop.staffCount }}</span></li>
        </ul>

        <div class="warehouse-list">
          <h4>仓库占用率</h4>
          <button
            v-for="item in workshopWarehouses"
            :key="item.id"
            :class="['warehouse-item', { active: warehouse?.id === item.id }]"
            @click="$emit('focusWarehouse', item.id)"
          >
            <span>{{ item.name }}</span>
            <strong>{{ item.occupancyRate.toFixed(1) }}%</strong>
          </button>
        </div>
      </div>

      <div v-else class="analysis-tab">
        <section class="toolbar">
          <div class="scope-title">
            <strong>{{ warehouse ? warehouse.name : `${workshop.name}（全部仓库）` }}</strong>
            <span>{{ seedInfo.startDate }} ~ {{ seedInfo.endDate }}</span>
          </div>
          <div class="granularity">
            <button
              v-for="mode in granularityButtons"
              :key="mode.key"
              :class="{ active: granularity === mode.key }"
              @click="$emit('update:granularity', mode.key)"
            >
              {{ mode.label }}
            </button>
          </div>
        </section>

        <section class="chart-card">
          <h4>入库 vs 出库</h4>
          <EChartPanel :option="flowOption" height="180px" />
        </section>

        <section class="metric-cards">
          <article>
            <label>当前库存</label>
            <strong>{{ summary.totalInventory.toLocaleString() }} 吨</strong>
          </article>
          <article>
            <label>库存金额</label>
            <strong>{{ summary.totalAmount.toLocaleString() }} 万元</strong>
          </article>
        </section>

        <section class="chart-card">
          <div class="chart-title-row">
            <h4>周转率/天数（按类别）</h4>
            <button class="text-button" @click="$emit('clearTurnoverFilter')">清除3D筛选</button>
          </div>
          <EChartPanel :option="turnoverOption" height="170px" @chart-click="handleClassChartClick" />
          <p class="hint">点击类别柱可高亮3D中对应仓库。</p>
        </section>

        <section class="table-card">
          <h4>呆滞物料 TOP10</h4>
          <table>
            <thead>
              <tr>
                <th>序号</th>
                <th>物料</th>
                <th>仓库</th>
                <th>数量</th>
                <th>天数</th>
                <th>金额(万元)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in stagnantTop" :key="`${row.warehouseId}-${row.materialCode}`">
                <td>{{ row.rank }}</td>
                <td>{{ row.materialName }}</td>
                <td>{{ row.warehouseName }}</td>
                <td>{{ row.stagnantQty }}</td>
                <td>{{ row.stagnantDays }}</td>
                <td>{{ row.stagnantAmount.toLocaleString() }}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { EChartsOption } from "echarts";
import EChartPanel from "@/components/EChartPanel.vue";
import type { WorkshopInfo } from "@/types/workshop";
import type {
  DateGranularity,
  FlowPoint,
  StagnantTopItem,
  TurnoverClass,
  TurnoverClassStat,
  WarehouseRuntime
} from "@/types/warehouse";

interface Props {
  workshop: WorkshopInfo;
  warehouse: WarehouseRuntime | null;
  workshopWarehouses: WarehouseRuntime[];
  granularity: DateGranularity;
  flowSeries: FlowPoint[];
  summary: {
    totalInventory: number;
    totalAmount: number;
    avgTurnoverRate: number;
    avgTurnoverDays: number;
    avgStagnantRatio: number;
  };
  turnoverClassStats: TurnoverClassStat[];
  stagnantTop: StagnantTopItem[];
  seedInfo: {
    seed: number;
    startDate: string;
    endDate: string;
  };
}

const props = defineProps<Props>();
const emit = defineEmits<{
  "update:granularity": [value: DateGranularity];
  focusWarehouse: [warehouseId: string];
  turnoverClassClick: [classKey: TurnoverClass];
  clearTurnoverFilter: [];
}>();

const activeTab = ref<"detail" | "analysis">("analysis");

const tabItems = [
  { key: "detail", label: "车间详情" },
  { key: "analysis", label: "仓储分析" }
] as const;

const granularityButtons: Array<{ key: DateGranularity; label: string }> = [
  { key: "day", label: "日" },
  { key: "week", label: "周" },
  { key: "month", label: "月" }
];

const flowOption = computed<EChartsOption>(() => ({
  backgroundColor: "transparent",
  tooltip: { trigger: "axis" },
  legend: {
    right: 0,
    top: 0,
    textStyle: { color: "#64748b", fontSize: 11 }
  },
  grid: { left: 36, right: 12, top: 28, bottom: 28 },
  xAxis: {
    type: "category",
    data: props.flowSeries.map((item) => item.label),
    axisLabel: { color: "#64748b", fontSize: 10 }
  },
  yAxis: {
    type: "value",
    axisLabel: { color: "#64748b", fontSize: 10 },
    splitLine: { lineStyle: { color: "#e2e8f0" } }
  },
  series: [
    {
      name: "入库",
      type: "line",
      smooth: true,
      data: props.flowSeries.map((item) => item.inbound),
      lineStyle: { color: "#2b6cb0", width: 2 },
      symbolSize: 4
    },
    {
      name: "出库",
      type: "line",
      smooth: true,
      data: props.flowSeries.map((item) => item.outbound),
      lineStyle: { color: "#d97706", width: 2 },
      symbolSize: 4
    }
  ]
}));

const turnoverOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
  legend: {
    right: 0,
    top: 0,
    textStyle: { color: "#64748b", fontSize: 11 }
  },
  grid: { left: 36, right: 12, top: 28, bottom: 26 },
  xAxis: {
    type: "category",
    data: props.turnoverClassStats.map((item) => item.classLabel),
    axisLabel: { color: "#64748b", fontSize: 10 }
  },
  yAxis: [
    {
      type: "value",
      name: "周转率",
      axisLabel: { color: "#64748b", fontSize: 10 },
      splitLine: { lineStyle: { color: "#e2e8f0" } }
    },
    {
      type: "value",
      name: "天数",
      axisLabel: { color: "#64748b", fontSize: 10 },
      splitLine: { show: false }
    }
  ],
  series: [
    {
      name: "平均周转率",
      type: "bar",
      data: props.turnoverClassStats.map((item) => item.avgTurnoverRate),
      itemStyle: { color: "#16a34a" }
    },
    {
      name: "平均天数",
      type: "bar",
      yAxisIndex: 1,
      data: props.turnoverClassStats.map((item) => item.avgTurnoverDays),
      itemStyle: { color: "#d97706" }
    }
  ]
}));

function handleClassChartClick(payload: { name?: string }) {
  const classMap: Record<string, TurnoverClass> = {
    高周转: "fast",
    中周转: "balanced",
    低周转: "slow"
  };
  const classKey = payload.name ? classMap[payload.name] : undefined;
  if (classKey) emit("turnoverClassClick", classKey);
}
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
  animation: fadeSlideUp 0.4s ease-out 0.1s both;
}

.panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px 10px;
  border-bottom: 1px solid var(--border-default);
}

.tabs {
  display: flex;
  gap: 6px;
}

.tabs button {
  border: 1px solid var(--border-default);
  background: var(--bg-inset);
  color: var(--text-secondary);
  border-radius: 6px;
  padding: 5px 10px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s ease;
}

.tabs button.active {
  border-color: var(--border-active);
  background: var(--c-primary-light);
  color: var(--c-primary);
  font-weight: 600;
}

.seed-tag {
  font-size: 11px;
  color: var(--text-muted);
}

.panel__body {
  min-height: 0;
  overflow: auto;
  padding: 10px 12px;
}

.detail-tab h3,
.analysis-tab h4 {
  margin: 0;
  color: var(--text-primary);
}

.desc {
  margin: 8px 0 10px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary);
}

.kv-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
}

.kv-list li {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  padding: 7px 10px;
  border: 1px solid var(--border-default);
  background: var(--bg-inset);
  border-radius: 6px;
  transition: background 0.2s ease;
}

.kv-list li:hover {
  background: var(--bg-card-hover);
}

.warehouse-list {
  margin-top: 12px;
}

.warehouse-list h4 {
  margin: 0 0 8px;
  font-size: 13px;
}

.warehouse-item {
  width: 100%;
  display: flex;
  justify-content: space-between;
  border: 1px solid var(--border-default);
  border-radius: 6px;
  background: var(--bg-inset);
  color: var(--text-secondary);
  font-size: 12px;
  padding: 7px 10px;
  margin-bottom: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.warehouse-item:hover {
  border-color: var(--border-active);
  background: var(--c-primary-light);
}

.warehouse-item.active {
  border-color: var(--border-active);
  background: var(--c-primary-light);
  color: var(--c-primary);
  font-weight: 600;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
  gap: 8px;
}

.scope-title strong {
  display: block;
  font-size: 14px;
  color: var(--text-primary);
}

.scope-title span {
  font-size: 11px;
  color: var(--text-muted);
}

.granularity {
  display: flex;
  gap: 4px;
}

.granularity button {
  border: 1px solid var(--border-default);
  background: var(--bg-inset);
  color: var(--text-secondary);
  border-radius: 5px;
  padding: 4px 8px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.granularity button.active {
  background: var(--c-primary-light);
  border-color: var(--border-active);
  color: var(--c-primary);
  font-weight: 600;
}

.chart-card {
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 10px;
  background: var(--bg-inset);
}

.chart-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.text-button {
  border: none;
  background: transparent;
  color: var(--c-primary);
  cursor: pointer;
  font-size: 11px;
  transition: opacity 0.2s;
}

.text-button:hover {
  opacity: 0.7;
}

.hint {
  margin: 4px 0 0;
  font-size: 11px;
  color: var(--text-muted);
}

.metric-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 10px;
}

.metric-cards article {
  padding: 12px 10px;
  border-radius: 8px;
  background: var(--bg-inset);
  border: 1px solid var(--border-default);
}

.metric-cards label {
  display: block;
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.metric-cards strong {
  font-size: 18px;
  color: var(--c-primary);
}

.table-card {
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 10px;
  background: var(--bg-inset);
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

th,
td {
  padding: 5px 4px;
  text-align: left;
  border-bottom: 1px solid var(--border-default);
}

thead th {
  color: var(--c-primary);
  font-weight: 600;
  font-size: 11px;
}

tbody tr:hover {
  background: var(--bg-card-hover);
}
</style>
