<template>
  <div class="agv-scene-root">
    <div ref="canvasHost" class="three-canvas-host"></div>

    <div class="overlay-top">
      <div class="strategy-badges">
        <span class="badge-label">当前策略</span>
        <span
          v-for="item in strategyItems"
          :key="item.key"
          :class="['badge', strategy[item.key] ? 'badge--on' : 'badge--off']"
          :title="item.desc"
        >
          {{ item.label }}
        </span>
      </div>
    </div>

    <div class="overlay-bottom">
      <div class="kpi-bar">
        <div class="kpi-item">
          <span class="kpi-label">总里程</span>
          <span class="kpi-before">{{ caseResult.kpi.totalDistanceBefore }}m</span>
          <span class="kpi-arrow">→</span>
          <span class="kpi-after">{{ caseResult.kpi.totalDistanceAfter }}m</span>
          <span class="kpi-delta" :class="deltaClass(caseResult.kpi.totalDistanceBefore, caseResult.kpi.totalDistanceAfter)">
            {{ deltaText(caseResult.kpi.totalDistanceBefore, caseResult.kpi.totalDistanceAfter) }}
          </span>
        </div>
        <div class="kpi-item">
          <span class="kpi-label">总耗时</span>
          <span class="kpi-before">{{ caseResult.kpi.totalDurationBefore }}min</span>
          <span class="kpi-arrow">→</span>
          <span class="kpi-after">{{ caseResult.kpi.totalDurationAfter }}min</span>
          <span class="kpi-delta" :class="deltaClass(caseResult.kpi.totalDurationBefore, caseResult.kpi.totalDurationAfter)">
            {{ deltaText(caseResult.kpi.totalDurationBefore, caseResult.kpi.totalDurationAfter) }}
          </span>
        </div>
        <div class="kpi-item">
          <span class="kpi-label">空载率</span>
          <span class="kpi-before">{{ caseResult.kpi.emptyRateBefore }}%</span>
          <span class="kpi-arrow">→</span>
          <span class="kpi-after">{{ caseResult.kpi.emptyRateAfter }}%</span>
          <span class="kpi-delta" :class="deltaClass(caseResult.kpi.emptyRateBefore, caseResult.kpi.emptyRateAfter)">
            {{ deltaText(caseResult.kpi.emptyRateBefore, caseResult.kpi.emptyRateAfter) }}
          </span>
        </div>
        <div class="kpi-item">
          <span class="kpi-label">等待时间</span>
          <span class="kpi-before">{{ caseResult.kpi.waitingMinutesBefore }}min</span>
          <span class="kpi-arrow">→</span>
          <span class="kpi-after">{{ caseResult.kpi.waitingMinutesAfter }}min</span>
          <span class="kpi-delta" :class="deltaClass(caseResult.kpi.waitingMinutesBefore, caseResult.kpi.waitingMinutesAfter)">
            {{ deltaText(caseResult.kpi.waitingMinutesBefore, caseResult.kpi.waitingMinutesAfter) }}
          </span>
        </div>
      </div>
    </div>

    <div class="overlay-side">
      <div class="strategy-desc-panel">
        <div class="desc-title">策略说明</div>
        <div
          v-for="item in strategyItems"
          :key="item.key"
          :class="['desc-row', { active: strategy[item.key] }]"
        >
          <span class="desc-dot" :class="strategy[item.key] ? 'dot-on' : 'dot-off'"></span>
          <div>
            <div class="desc-name">{{ item.label }}</div>
            <div class="desc-text">{{ item.desc }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import networkConfig from "@/mock/agv/network.json";
import { useAgvScene } from "@/composables/useAgvScene";
import type { AgvCaseRunResult, AgvEdge, AgvNode, AgvStrategyConfig, AgvStrategyKey } from "@/types/agv";

interface Props {
  caseResult: AgvCaseRunResult;
  strategy: AgvStrategyConfig;
  playing: boolean;
}

const props = defineProps<Props>();
const canvasHost = ref<HTMLElement | null>(null);
const nodes = networkConfig.nodes as AgvNode[];
const edges = networkConfig.edges as AgvEdge[];

let sceneApi: ReturnType<typeof useAgvScene> | null = null;

const strategyItems: Array<{ key: AgvStrategyKey; label: string; desc: string }> = [
  { key: "nearest", label: "就近优先", desc: "优先分配距离最近的AGV接单，减少空载里程" },
  { key: "avoidCongestion", label: "避拥堵", desc: "基于拥堵热力数据动态避开高峰路段，降低等待" },
  { key: "mergeTask", label: "合并任务", desc: "同方向同路线任务合并派发，提升AGV装载利用率" },
  { key: "timeWindow", label: "时间窗调度", desc: "依据任务时间窗约束智能排程，减少延迟惩罚" }
];

function deltaText(before: number, after: number): string {
  if (before <= 0) return "0%";
  const pct = ((before - after) / before * 100).toFixed(1);
  return Number(pct) >= 0 ? `↓${pct}%` : `↑${Math.abs(Number(pct)).toFixed(1)}%`;
}

function deltaClass(before: number, after: number): string {
  return after <= before ? "delta-good" : "delta-bad";
}

function resetAnimation() {
  sceneApi?.reset();
  if (props.playing) sceneApi?.play();
}

defineExpose({ resetAnimation });

onMounted(() => {
  if (!canvasHost.value) return;
  sceneApi = useAgvScene({ container: canvasHost.value, nodes, edges });
  sceneApi.setCaseResult(props.caseResult);
  if (props.playing) sceneApi.play();
  else sceneApi.pause();
});

watch(
  () => props.caseResult,
  (value) => {
    sceneApi?.setCaseResult(value);
    if (props.playing) sceneApi?.play();
    else sceneApi?.pause();
  },
  { deep: true }
);

watch(
  () => props.playing,
  (value) => {
    if (value) sceneApi?.play();
    else sceneApi?.pause();
  }
);

onBeforeUnmount(() => {
  sceneApi?.destroy();
  sceneApi = null;
});
</script>

<style scoped>
.agv-scene-root {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 480px;
}

.three-canvas-host {
  width: 100%;
  height: 100%;
}

/* ---- top: strategy badges ---- */
.overlay-top {
  position: absolute;
  top: 10px;
  left: 10px;
  right: 10px;
  pointer-events: none;
  z-index: 5;
}

.strategy-badges {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.badge-label {
  font-size: 11px;
  font-weight: 700;
  color: #1e293b;
  background: rgba(255,255,255,0.88);
  padding: 4px 10px;
  border-radius: 6px;
  backdrop-filter: blur(4px);
}

.badge {
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
  backdrop-filter: blur(4px);
  transition: all 0.25s ease;
}

.badge--on {
  background: rgba(22, 163, 106, 0.18);
  color: #15803d;
  border: 1px solid rgba(22, 163, 106, 0.35);
}

.badge--off {
  background: rgba(100, 116, 139, 0.12);
  color: #94a3b8;
  border: 1px solid rgba(100, 116, 139, 0.2);
  text-decoration: line-through;
}

/* ---- bottom: kpi comparison bar ---- */
.overlay-bottom {
  position: absolute;
  bottom: 10px;
  left: 10px;
  right: 10px;
  pointer-events: none;
  z-index: 5;
}

.kpi-bar {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.kpi-item {
  flex: 1;
  min-width: 120px;
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(6px);
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.kpi-label {
  font-size: 10px;
  font-weight: 700;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.kpi-before {
  font-size: 11px;
  color: #dc2626;
  font-weight: 600;
}

.kpi-arrow {
  font-size: 10px;
  color: #94a3b8;
}

.kpi-after {
  font-size: 11px;
  color: #16a34a;
  font-weight: 600;
}

.kpi-delta {
  font-size: 12px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
}

.delta-good {
  color: #15803d;
  background: rgba(22, 163, 106, 0.12);
}

.delta-bad {
  color: #dc2626;
  background: rgba(220, 38, 38, 0.1);
}

/* ---- right side: strategy descriptions ---- */
.overlay-side {
  position: absolute;
  top: 44px;
  right: 10px;
  width: 180px;
  pointer-events: none;
  z-index: 5;
}

.strategy-desc-panel {
  background: rgba(255,255,255,0.9);
  backdrop-filter: blur(6px);
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 10px;
}

.desc-title {
  font-size: 12px;
  font-weight: 700;
  color: #1e40af;
  margin-bottom: 8px;
  padding-bottom: 5px;
  border-bottom: 1px solid #e2e8f0;
}

.desc-row {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  padding: 4px 0;
  opacity: 0.5;
  transition: opacity 0.2s ease;
}

.desc-row.active {
  opacity: 1;
}

.desc-dot {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  margin-top: 4px;
}

.dot-on {
  background: #16a34a;
  box-shadow: 0 0 4px rgba(22, 163, 106, 0.5);
}

.dot-off {
  background: #cbd5e1;
}

.desc-name {
  font-size: 11px;
  font-weight: 600;
  color: #334155;
  line-height: 1.3;
}

.desc-text {
  font-size: 10px;
  color: #64748b;
  line-height: 1.4;
}
</style>
