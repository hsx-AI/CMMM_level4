<template>
  <section class="panel">
    <header class="panel__header">
      <h3>AGV调度控制台</h3>
      <div class="actions">
        <button @click="$emit('togglePlay')">{{ playing ? "暂停动画" : "播放动画" }}</button>
        <button @click="$emit('resetAnimation')">重播</button>
        <button @click="printReport">导出案例报告</button>
      </div>
    </header>

    <div class="panel__body">
      <section class="block">
        <h4>案例切换</h4>
        <div class="case-list">
          <button
            v-for="item in cases"
            :key="item.id"
            :class="{ active: item.id === activeCaseId }"
            @click="$emit('changeCase', item.id)"
          >
            <strong>{{ item.title }}</strong>
            <span>{{ item.summary }}</span>
          </button>
        </div>
      </section>

      <section class="block">
        <h4>策略选择</h4>
        <div class="strategy-grid">
          <label v-for="item in strategyItems" :key="item.key">
            <input
              type="checkbox"
              :checked="strategy[item.key]"
              @change="$emit('changeStrategy', item.key, !strategy[item.key])"
            />
            <span>{{ item.label }}</span>
          </label>
        </div>
      </section>

      <section class="block block--report" id="agv-report-summary">
        <h4>价值举证</h4>
        <div class="metric-cards">
          <article>
            <label>总里程优化</label>
            <strong>{{ deltaPercent(result.kpi.totalDistanceBefore, result.kpi.totalDistanceAfter) }}%</strong>
            <span>{{ result.kpi.totalDistanceBefore }} -> {{ result.kpi.totalDistanceAfter }} 米</span>
          </article>
          <article>
            <label>总耗时优化</label>
            <strong>{{ deltaPercent(result.kpi.totalDurationBefore, result.kpi.totalDurationAfter) }}%</strong>
            <span>{{ result.kpi.totalDurationBefore }} -> {{ result.kpi.totalDurationAfter }} 分钟</span>
          </article>
          <article>
            <label>空载率改善</label>
            <strong>{{ deltaPercent(result.kpi.emptyRateBefore, result.kpi.emptyRateAfter) }}%</strong>
            <span>{{ result.kpi.emptyRateBefore }}% -> {{ result.kpi.emptyRateAfter }}%</span>
          </article>
          <article>
            <label>拥堵等待改善</label>
            <strong>{{ deltaPercent(result.kpi.waitingMinutesBefore, result.kpi.waitingMinutesAfter) }}%</strong>
            <span>{{ result.kpi.waitingMinutesBefore }} -> {{ result.kpi.waitingMinutesAfter }} 分钟</span>
          </article>
        </div>
        <EChartPanel :option="valueCompareOption" height="220px" />
      </section>

      <section class="block">
        <h4>任务列表</h4>
        <div class="task-table-wrap">
          <table class="task-table">
            <thead>
              <tr>
                <th>任务</th>
                <th>起点</th>
                <th>终点</th>
                <th>物料</th>
                <th>优先级</th>
                <th>时间窗</th>
                <th>AGV</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="task in result.tasks" :key="task.id">
                <td>{{ task.id }}</td>
                <td>{{ task.from }}</td>
                <td>{{ task.to }}</td>
                <td>{{ task.materialType }}</td>
                <td>P{{ task.priority }}</td>
                <td>{{ task.timeWindowStart }}-{{ task.timeWindowEnd }}</td>
                <td>{{ task.agvId }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="block">
        <h4>路径对比（红=优化前，绿=优化后）</h4>
        <div class="path-list">
          <div v-for="task in result.tasks" :key="`${task.id}-path`" class="path-row">
            <span>{{ task.id }}</span>
            <span class="before">优化前 {{ task.beforePath.distance }}米</span>
            <span class="after">优化后 {{ task.afterPath.distance }}米</span>
            <span class="avoid">避拥堵 {{ task.afterPath.heatAvoidedEdges.length }} 条</span>
          </div>
        </div>
      </section>

      <section class="block">
        <h4>可解释日志</h4>
        <ul class="log-list">
          <li v-for="line in result.logs" :key="line">{{ line }}</li>
        </ul>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { EChartsOption } from "echarts";
import EChartPanel from "@/components/EChartPanel.vue";
import type { AgvCaseId, AgvCaseMeta, AgvCaseRunResult, AgvStrategyConfig, AgvStrategyKey } from "@/types/agv";

interface Props {
  cases: AgvCaseMeta[];
  activeCaseId: AgvCaseId;
  strategy: AgvStrategyConfig;
  result: AgvCaseRunResult;
  playing: boolean;
}

const props = defineProps<Props>();
defineEmits<{
  changeCase: [caseId: AgvCaseId];
  changeStrategy: [key: AgvStrategyKey, value: boolean];
  togglePlay: [];
  resetAnimation: [];
}>();

const strategyItems: Array<{ key: AgvStrategyKey; label: string }> = [
  { key: "nearest", label: "就近优先" },
  { key: "avoidCongestion", label: "避拥堵" },
  { key: "mergeTask", label: "合并任务" },
  { key: "timeWindow", label: "时间窗调度" }
];

const valueCompareOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
  legend: {
    right: 0,
    top: 0,
    textStyle: { color: "#64748b", fontSize: 11 }
  },
  grid: { left: 56, right: 12, top: 34, bottom: 28 },
  xAxis: {
    type: "value",
    axisLabel: { color: "#64748b", fontSize: 10 },
    splitLine: { lineStyle: { color: "#e2e8f0" } }
  },
  yAxis: {
    type: "category",
    axisLabel: { color: "#64748b", fontSize: 10 },
    data: ["总里程", "总耗时", "空载率", "拥堵等待"]
  },
  series: [
    {
      type: "bar",
      name: "优化前",
      itemStyle: { color: "#dc2626" },
      data: [
        props.result.kpi.totalDistanceBefore,
        props.result.kpi.totalDurationBefore,
        props.result.kpi.emptyRateBefore,
        props.result.kpi.waitingMinutesBefore
      ]
    },
    {
      type: "bar",
      name: "优化后",
      itemStyle: { color: "#16a34a" },
      data: [
        props.result.kpi.totalDistanceAfter,
        props.result.kpi.totalDurationAfter,
        props.result.kpi.emptyRateAfter,
        props.result.kpi.waitingMinutesAfter
      ]
    }
  ]
}));

function deltaPercent(before: number, after: number): string {
  if (before <= 0) return "0.0";
  return (((before - after) / before) * 100).toFixed(1);
}

function printReport() {
  window.print();
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

.actions {
  display: flex;
  gap: 6px;
}

.actions button,
.case-list button {
  border: 1px solid var(--border-default);
  background: var(--bg-inset);
  color: var(--text-secondary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.actions button:hover,
.case-list button:hover {
  border-color: var(--border-active);
  background: var(--c-primary-light);
  color: var(--c-primary);
}

.actions button {
  padding: 5px 8px;
  font-size: 11px;
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

.case-list {
  display: grid;
  gap: 6px;
}

.case-list button {
  text-align: left;
  padding: 8px;
}

.case-list button strong {
  display: block;
  font-size: 12px;
  color: var(--text-primary);
}

.case-list button span {
  font-size: 11px;
  color: var(--text-secondary);
}

.case-list button.active {
  border-color: var(--border-active);
  background: var(--c-primary-light);
  font-weight: 600;
}

.strategy-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.strategy-grid label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.metric-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 8px;
}

.metric-cards article {
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 10px;
  background: #ffffff;
}

.metric-cards label {
  display: block;
  font-size: 11px;
  color: var(--text-secondary);
}

.metric-cards strong {
  font-size: 18px;
  color: var(--c-primary);
}

.metric-cards span {
  display: block;
  font-size: 11px;
  color: var(--text-muted);
}

.task-table-wrap {
  max-height: 180px;
  overflow: auto;
}

.task-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.task-table th,
.task-table td {
  padding: 5px 4px;
  border-bottom: 1px solid var(--border-default);
  text-align: left;
}

.task-table th {
  color: var(--c-primary);
  font-weight: 600;
}

.task-table tbody tr:hover {
  background: var(--bg-card-hover);
}

.path-list {
  display: grid;
  gap: 5px;
}

.path-row {
  display: grid;
  grid-template-columns: 60px 1fr 1fr 90px;
  gap: 8px;
  font-size: 11px;
}

.path-row .before {
  color: var(--c-red);
}

.path-row .after {
  color: var(--c-green);
}

.path-row .avoid {
  color: var(--c-cyan);
}

.log-list {
  margin: 0;
  padding-left: 16px;
  display: grid;
  gap: 4px;
  font-size: 11px;
  color: var(--text-secondary);
}

@media print {
  .actions,
  .case-list,
  .strategy-grid,
  .task-table-wrap,
  .path-list,
  .log-list {
    display: none;
  }
  .panel {
    border: none;
    background: white;
    color: black;
  }
  .block {
    border: none;
    background: transparent;
  }
}
</style>
