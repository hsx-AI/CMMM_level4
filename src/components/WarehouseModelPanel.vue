<template>
  <section class="panel">
    <header class="panel__header">
      <h3>电机公司仓储模型</h3>
      <span class="badge">水火电发电机 · 仓储优化分析</span>
    </header>

    <div class="panel__body">
      <!-- 公司总览 -->
      <section class="block">
        <h4>公司仓储总览</h4>
        <div class="overview-grid">
          <div class="ov-card">
            <label>仓库总数</label>
            <strong>{{ overview.warehouseCount }}<small>个</small></strong>
          </div>
          <div class="ov-card">
            <label>总库存</label>
            <strong>{{ overview.totalInventory.toLocaleString() }}<small>吨</small></strong>
          </div>
          <div class="ov-card">
            <label>资金占用</label>
            <strong>{{ overview.totalAmount.toLocaleString() }}<small>万元</small></strong>
          </div>
          <div class="ov-card">
            <label>平均占用率</label>
            <strong>{{ overview.avgOccupancy }}<small>%</small></strong>
          </div>
          <div class="ov-card">
            <label>平均周转</label>
            <strong>{{ overview.avgTurnoverDays }}<small>天</small></strong>
          </div>
          <div class="ov-card">
            <label>呆滞占比</label>
            <strong>{{ overview.avgStagnantRatio }}<small>%</small></strong>
          </div>
        </div>
      </section>

      <!-- 库群分析 -->
      <section class="block">
        <h4>库群分类分析</h4>
        <EChartPanel :option="categoryChartOption" height="200px" />
        <div class="cat-list">
          <div
            v-for="cat in categoryAnalyses"
            :key="cat.category.id"
            class="cat-item"
          >
            <div class="cat-head">
              <span class="cat-label">{{ cat.category.label }}</span>
              <span :class="['status-dot', cat.status]" />
            </div>
            <div class="cat-desc">{{ cat.category.description }}</div>
            <div class="cat-metrics">
              <span>库存 <b>{{ cat.totalInventory.toLocaleString() }}</b>吨</span>
              <span>占用 <b>{{ cat.avgOccupancy }}%</b></span>
              <span>周转 <b>{{ cat.avgTurnoverDays }}</b>天</span>
              <span>呆滞 <b>{{ cat.avgStagnantRatio }}%</b></span>
            </div>
          </div>
        </div>
      </section>

      <!-- 优化方案选择 -->
      <section class="block">
        <h4>优化方案对比</h4>
        <div class="scenario-list">
          <button
            v-for="s in scenarios"
            :key="s.id"
            :class="['scenario-btn', { active: s.id === activeScenarioId }]"
            @click="$emit('changeScenario', s.id)"
          >
            <strong>{{ s.title }}</strong>
            <span>{{ s.summary }}</span>
          </button>
        </div>
      </section>

      <!-- KPI 改善效果 -->
      <section class="block block--kpi">
        <h4>改善效果预估</h4>
        <div class="kpi-cards">
          <article v-for="kpi in kpiComparison" :key="kpi.label">
            <label>{{ kpi.label }}</label>
            <strong :class="kpi.before !== kpi.after ? 'improved' : ''">
              {{ deltaPercent(kpi) }}%
            </strong>
            <span>{{ kpi.before }} → {{ kpi.after }} {{ kpi.unit }}</span>
          </article>
        </div>
        <EChartPanel :option="kpiChartOption" height="220px" />
      </section>

      <!-- 优化建议 -->
      <section class="block">
        <h4>专项优化建议</h4>
        <div class="suggestion-list">
          <div
            v-for="sug in suggestions"
            :key="sug.id"
            class="sug-card"
          >
            <div class="sug-head">
              <span :class="['priority-tag', sug.priority]">{{ priorityLabel(sug.priority) }}</span>
              <strong>{{ sug.title }}</strong>
            </div>
            <p>{{ sug.description }}</p>
            <div class="sug-impact">{{ sug.impact }}</div>
          </div>
        </div>
      </section>

      <!-- 生产特点说明 -->
      <section class="block block--note">
        <h4>水火电发电机生产仓储特征</h4>
        <ul class="feature-list">
          <li><b>长周期</b>：大型水电机组定子铁芯单件重达数十吨，从冲片到叠装周期长，原料需提前备货</li>
          <li><b>多品种</b>：水电/火电/风电机组型号各异，铜排、硅钢片规格多，SKU数量大</li>
          <li><b>高价值</b>：铜材、稀土磁钢等单价高，库存资金占用压力大</li>
          <li><b>季节性</b>：水电机组交付受汛期影响，年中出库高峰，年末备料高峰</li>
          <li><b>工序耦合</b>：线圈→铁芯→总装工序紧密衔接，中间库缓冲需精准控制</li>
        </ul>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { EChartsOption } from "echarts";
import EChartPanel from "@/components/EChartPanel.vue";
import type {
  CategoryAnalysis,
  OptKpi,
  OptScenario,
  OptSuggestion
} from "@/composables/useWarehouseOptModel";

interface Props {
  overview: {
    totalInventory: number;
    totalCapacity: number;
    totalAmount: number;
    avgOccupancy: number;
    avgTurnoverDays: number;
    avgStagnantRatio: number;
    warehouseCount: number;
  };
  categoryAnalyses: CategoryAnalysis[];
  scenarios: OptScenario[];
  activeScenarioId: string;
  kpiComparison: OptKpi[];
  suggestions: OptSuggestion[];
}

const props = defineProps<Props>();
defineEmits<{
  changeScenario: [id: string];
}>();

const categoryChartOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
  legend: { right: 0, top: 0, textStyle: { color: "#64748b", fontSize: 10 } },
  grid: { left: 56, right: 12, top: 30, bottom: 28 },
  xAxis: {
    type: "category",
    data: props.categoryAnalyses.map((c) => c.category.label),
    axisLabel: { color: "#64748b", fontSize: 9, rotate: 15 }
  },
  yAxis: [
    {
      type: "value",
      name: "吨",
      axisLabel: { color: "#64748b", fontSize: 10 },
      splitLine: { lineStyle: { color: "#e2e8f0" } }
    },
    {
      type: "value",
      name: "%",
      axisLabel: { color: "#64748b", fontSize: 10 },
      splitLine: { show: false }
    }
  ],
  series: [
    {
      name: "库存(吨)",
      type: "bar",
      data: props.categoryAnalyses.map((c) => c.totalInventory),
      itemStyle: { color: "#2b6cb0" }
    },
    {
      name: "占用率(%)",
      type: "bar",
      yAxisIndex: 1,
      data: props.categoryAnalyses.map((c) => c.avgOccupancy),
      itemStyle: { color: "#d97706" }
    },
    {
      name: "周转天数",
      type: "line",
      yAxisIndex: 1,
      data: props.categoryAnalyses.map((c) => c.avgTurnoverDays),
      lineStyle: { color: "#16a34a", width: 2 },
      symbolSize: 6
    }
  ]
}));

const kpiChartOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
  legend: { right: 0, top: 0, textStyle: { color: "#64748b", fontSize: 11 } },
  grid: { left: 80, right: 12, top: 34, bottom: 28 },
  xAxis: {
    type: "value",
    axisLabel: { color: "#64748b", fontSize: 10 },
    splitLine: { lineStyle: { color: "#e2e8f0" } }
  },
  yAxis: {
    type: "category",
    axisLabel: { color: "#64748b", fontSize: 10 },
    data: props.kpiComparison.map((k) => k.label)
  },
  series: [
    {
      type: "bar",
      name: "优化前",
      itemStyle: { color: "#dc2626" },
      data: props.kpiComparison.map((k) => k.before)
    },
    {
      type: "bar",
      name: "优化后",
      itemStyle: { color: "#16a34a" },
      data: props.kpiComparison.map((k) => k.after)
    }
  ]
}));

function deltaPercent(kpi: OptKpi): string {
  if (kpi.before <= 0) return "0.0";
  const delta = ((kpi.before - kpi.after) / kpi.before) * 100;
  return delta.toFixed(1);
}

function priorityLabel(p: string): string {
  if (p === "high") return "高优";
  if (p === "medium") return "中优";
  return "建议";
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
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-default);
}

.panel__header h3 {
  margin: 0;
  font-size: 15px;
  color: var(--c-primary);
}

.badge {
  font-size: 11px;
  color: var(--c-cyan);
  padding: 3px 10px;
  background: rgba(8, 145, 178, 0.08);
  border: 1px solid rgba(8, 145, 178, 0.2);
  border-radius: 5px;
}

.panel__body {
  min-height: 0;
  overflow: auto;
  padding: 10px;
  display: grid;
  gap: 10px;
}

.block {
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 10px;
  background: var(--bg-inset);
}

.block h4 {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--text-primary);
}

/* 总览卡片 */
.overview-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.ov-card {
  padding: 8px;
  border: 1px solid var(--border-default);
  border-radius: 6px;
  background: #ffffff;
  text-align: center;
}

.ov-card label {
  display: block;
  font-size: 10px;
  color: var(--text-secondary);
  margin-bottom: 2px;
}

.ov-card strong {
  font-size: 16px;
  color: var(--c-primary);
}

.ov-card small {
  font-size: 10px;
  color: var(--text-muted);
  margin-left: 2px;
}

/* 库群列表 */
.cat-list {
  display: grid;
  gap: 6px;
  margin-top: 8px;
}

.cat-item {
  border: 1px solid var(--border-default);
  border-radius: 6px;
  padding: 8px 10px;
  background: #ffffff;
}

.cat-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.cat-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot.healthy { background: #16a34a; }
.status-dot.warning { background: #d97706; }
.status-dot.critical { background: #dc2626; }

.cat-desc {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.cat-metrics {
  display: flex;
  gap: 10px;
  font-size: 11px;
  color: var(--text-secondary);
}

.cat-metrics b {
  color: var(--text-primary);
}

/* 方案选择 */
.scenario-list {
  display: grid;
  gap: 6px;
}

.scenario-btn {
  text-align: left;
  padding: 8px 10px;
  border: 1px solid var(--border-default);
  border-radius: 6px;
  background: #ffffff;
  cursor: pointer;
  transition: all 0.2s ease;
}

.scenario-btn:hover {
  border-color: var(--border-active);
  background: var(--c-primary-light);
}

.scenario-btn.active {
  border-color: var(--border-active);
  background: var(--c-primary-light);
}

.scenario-btn strong {
  display: block;
  font-size: 12px;
  color: var(--text-primary);
}

.scenario-btn span {
  font-size: 11px;
  color: var(--text-secondary);
}

/* KPI */
.kpi-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-bottom: 8px;
}

.kpi-cards article {
  border: 1px solid var(--border-default);
  border-radius: 6px;
  padding: 8px 10px;
  background: #ffffff;
}

.kpi-cards label {
  display: block;
  font-size: 10px;
  color: var(--text-secondary);
}

.kpi-cards strong {
  font-size: 18px;
  color: var(--text-muted);
}

.kpi-cards strong.improved {
  color: var(--c-green);
}

.kpi-cards span {
  display: block;
  font-size: 11px;
  color: var(--text-muted);
}

/* 优化建议 */
.suggestion-list {
  display: grid;
  gap: 6px;
}

.sug-card {
  border: 1px solid var(--border-default);
  border-radius: 6px;
  padding: 8px 10px;
  background: #ffffff;
}

.sug-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.sug-head strong {
  font-size: 12px;
  color: var(--text-primary);
}

.priority-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: 600;
}

.priority-tag.high {
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
}

.priority-tag.medium {
  background: rgba(217, 119, 6, 0.1);
  color: #d97706;
}

.priority-tag.low {
  background: rgba(8, 145, 178, 0.1);
  color: #0891b2;
}

.sug-card p {
  margin: 0 0 4px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-secondary);
}

.sug-impact {
  font-size: 11px;
  color: var(--c-green);
  font-weight: 600;
}

/* 生产特征 */
.feature-list {
  margin: 0;
  padding-left: 16px;
  display: grid;
  gap: 5px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-secondary);
}

.feature-list b {
  color: var(--c-primary);
}
</style>
