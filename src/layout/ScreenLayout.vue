<template>
  <main class="screen">
    <header class="top-bar">
      <h1>{{ headerTitle }}</h1>
      <span class="badge">{{ headerBadge }}</span>
    </header>

    <section class="content-grid">
      <LeftNav
        :items="NAV_ITEMS"
        :active-key="activeNavKey"
        @change="activeNavKey = $event"
      />

      <section class="center-column">
        <section class="scene-panel">
          <template v-if="!isAgvMode">
            <div class="scene-toolbar">
              <span class="scene-toolbar__label">车间</span>
              <div class="scene-toolbar__buttons">
                <button
                  v-for="w in WORKSHOPS"
                  :key="w.id"
                  :class="['scene-toolbar__btn', { active: selectedWorkshop.id === w.id }]"
                  @click="handleFocusWorkshop(w.id)"
                >
                  {{ w.name }}
                </button>
              </div>
            </div>
            <div class="scene-canvas-wrap">
              <ThreePlantCanvas
                ref="threeCanvasRef"
                :workshops="WORKSHOPS"
                :warehouses="warehouseModel.allWarehouses"
                :initial-workshop-id="selectedWorkshop.id"
                @workshop-selected="handleWorkshopSelected"
                @warehouse-selected="handleWarehouseSelected"
              />
            </div>
          </template>
          <AgvSceneCanvas
            v-else
            ref="agvSceneRef"
            :case-result="agvModel.result.value"
            :playing="agvPlaying"
          />
        </section>

        <AdjustTerminal
          v-if="isWarehouseMode"
          class="adjust-terminal"
          :orders="whOptModel.adjustOrders.value"
          :scenario-title="activeScenarioLabel"
          @update-qty="whOptModel.updateOrderQty"
          @remove-order="whOptModel.removeOrder"
          @dispatch="handleDispatch"
        />
      </section>

      <RightPanel
        v-if="isOverviewMode"
        :workshop="selectedWorkshop"
        :warehouse="selectedWarehouse"
        :workshop-warehouses="workshopWarehouses"
        :granularity="granularity"
        :flow-series="flowSeries"
        :summary="summary"
        :turnover-class-stats="turnoverClassStats"
        :stagnant-top="stagnantTop"
        :seed-info="warehouseModel.seedInfo"
        @update:granularity="granularity = $event"
        @focus-warehouse="handleFocusWarehouse"
        @turnover-class-click="handleTurnoverFilter"
        @clear-turnover-filter="clearTurnoverFilter"
      />
      <WarehouseModelPanel
        v-else-if="isWarehouseMode"
        :overview="whOptModel.companyOverview.value"
        :category-analyses="whOptModel.categoryAnalyses.value"
        :scenarios="whOptModel.scenarios"
        :active-scenario-id="whOptModel.activeScenarioId.value"
        :kpi-comparison="whOptModel.kpiComparison.value"
        :suggestions="whOptModel.suggestions"
        @change-scenario="whOptModel.setScenario"
      />
      <AgvPanel
        v-else-if="isAgvMode"
        :cases="agvModel.cases"
        :active-case-id="agvModel.activeCaseId.value"
        :strategy="agvModel.strategy.value"
        :result="agvModel.result.value"
        :playing="agvPlaying"
        @change-case="handleAgvCaseChange"
        @change-strategy="handleAgvStrategyChange"
        @toggle-play="agvPlaying = !agvPlaying"
        @reset-animation="agvSceneRef?.resetAnimation()"
      />
      <RightPanel
        v-else
        :workshop="selectedWorkshop"
        :warehouse="selectedWarehouse"
        :workshop-warehouses="workshopWarehouses"
        :granularity="granularity"
        :flow-series="flowSeries"
        :summary="summary"
        :turnover-class-stats="turnoverClassStats"
        :stagnant-top="stagnantTop"
        :seed-info="warehouseModel.seedInfo"
        @update:granularity="granularity = $event"
        @focus-warehouse="handleFocusWarehouse"
        @turnover-class-click="handleTurnoverFilter"
        @clear-turnover-filter="clearTurnoverFilter"
      />
    </section>

    <footer class="bottom-bar">
      <template v-if="isWarehouseMode">
        <span>模式：仓储优化分析</span>
        <span>仓库：{{ whOptModel.companyOverview.value.warehouseCount }} 个</span>
        <span>总库存：{{ whOptModel.companyOverview.value.totalInventory.toLocaleString() }} 吨</span>
        <span>资金占用：{{ whOptModel.companyOverview.value.totalAmount.toLocaleString() }} 万元</span>
        <span>方案：{{ activeScenarioLabel }}</span>
      </template>
      <template v-else-if="isAgvMode">
        <span>案例：{{ agvModel.activeCase.value.title }}</span>
        <span>距离：{{ agvModel.result.value.kpi.totalDistanceBefore }} -> {{ agvModel.result.value.kpi.totalDistanceAfter }} 米</span>
        <span>耗时：{{ agvModel.result.value.kpi.totalDurationBefore }} -> {{ agvModel.result.value.kpi.totalDurationAfter }} 分钟</span>
        <span>空载率：{{ agvModel.result.value.kpi.emptyRateBefore }}% -> {{ agvModel.result.value.kpi.emptyRateAfter }}%</span>
        <span>等待：{{ agvModel.result.value.kpi.waitingMinutesBefore }} -> {{ agvModel.result.value.kpi.waitingMinutesAfter }} 分钟</span>
      </template>
      <template v-else>
        <span>车间：{{ selectedWorkshop.name }}</span>
        <span>仓库：{{ selectedWarehouse?.name ?? "全部" }}</span>
        <span>库存：{{ summary.totalInventory.toLocaleString() }} 吨</span>
        <span>金额：{{ summary.totalAmount.toLocaleString() }} 万元</span>
        <span>筛选：{{ turnoverFilterLabel }}</span>
      </template>
    </footer>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import LeftNav from "@/components/LeftNav.vue";
import ThreePlantCanvas from "@/components/ThreePlantCanvas.vue";
import RightPanel from "@/components/RightPanel.vue";
import WarehouseModelPanel from "@/components/WarehouseModelPanel.vue";
import AgvSceneCanvas from "@/components/AgvSceneCanvas.vue";
import AgvPanel from "@/components/AgvPanel.vue";
import AdjustTerminal from "@/components/AdjustTerminal.vue";
import { DEFAULT_WORKSHOP_ID, NAV_ITEMS, SCREEN_TITLE, WORKSHOPS } from "@/mock/workshops";
import { useWarehouseModel } from "@/composables/useWarehouseModel";
import { useWarehouseOptModel } from "@/composables/useWarehouseOptModel";
import { useAgvModel } from "@/composables/useAgvModel";
import type { DateGranularity, TurnoverClass, WarehouseRuntime } from "@/types/warehouse";
import type { AgvCaseId, AgvStrategyKey } from "@/types/agv";

const warehouseModel = useWarehouseModel(WORKSHOPS);
const whOptModel = useWarehouseOptModel(warehouseModel.allWarehouses);
const agvModel = useAgvModel();

const activeNavKey = ref("overview");
const granularity = ref<DateGranularity>("week");
const selectedWorkshop = ref(
  WORKSHOPS.find((item) => item.id === DEFAULT_WORKSHOP_ID) ?? WORKSHOPS[0]
);
const selectedWarehouseId = ref<string | null>(null);
const turnoverFilter = ref<TurnoverClass | null>(null);
const agvPlaying = ref(true);

const threeCanvasRef = ref<InstanceType<typeof ThreePlantCanvas> | null>(null);
const agvSceneRef = ref<InstanceType<typeof AgvSceneCanvas> | null>(null);

const isOverviewMode = computed(() => activeNavKey.value === "overview");
const isWarehouseMode = computed(() => activeNavKey.value === "warehouse");
const isAgvMode = computed(() => activeNavKey.value === "agv");

const headerTitle = computed(() => SCREEN_TITLE);
const headerBadge = computed(() => {
  if (isAgvMode.value) return "路径对比 / 调度 / 价值举证";
  if (isWarehouseMode.value) return "周转分析 / 优化建议 / 改善效果";
  return "厂区总览 / 车间详情 / 仓储分析";
});

const activeScenarioLabel = computed(() => {
  const s = whOptModel.scenarios.find((item) => item.id === whOptModel.activeScenarioId.value);
  return s?.title ?? "现状基线";
});

const selectedWarehouse = computed(() => warehouseModel.getWarehouseById(selectedWarehouseId.value));
const workshopWarehouses = computed(() =>
  warehouseModel.getWarehousesByWorkshop(selectedWorkshop.value.id)
);
const flowSeries = computed(() =>
  warehouseModel.getFlowSeriesByScope(
    selectedWorkshop.value.id,
    selectedWarehouse.value?.id ?? null,
    granularity.value
  )
);
const summary = computed(() =>
  warehouseModel.getScopeSummary(selectedWorkshop.value.id, selectedWarehouse.value?.id ?? null)
);
const turnoverClassStats = computed(() =>
  warehouseModel.getTurnoverClassStats(selectedWorkshop.value.id)
);
const stagnantTop = computed(() =>
  warehouseModel.getStagnantTop10(selectedWorkshop.value.id, selectedWarehouse.value?.id ?? null)
);
const turnoverFilterLabel = computed(() => {
  if (!turnoverFilter.value) return "无";
  if (turnoverFilter.value === "fast") return "高周转";
  if (turnoverFilter.value === "balanced") return "中周转";
  return "低周转";
});

function handleWorkshopSelected(workshop: (typeof WORKSHOPS)[number]) {
  selectedWorkshop.value = workshop;
  if (selectedWarehouse.value && selectedWarehouse.value.workshopId !== workshop.id) {
    selectedWarehouseId.value = null;
  }
}

function handleWarehouseSelected(warehouse: WarehouseRuntime) {
  const workshop = WORKSHOPS.find((item) => item.id === warehouse.workshopId);
  if (workshop) selectedWorkshop.value = workshop;
  selectedWarehouseId.value = warehouse.id;
}

function handleFocusWorkshop(workshopId: string) {
  if (isAgvMode.value) return;
  const workshop = WORKSHOPS.find((item) => item.id === workshopId);
  if (!workshop) return;
  selectedWorkshop.value = workshop;
  selectedWarehouseId.value = null;
  clearTurnoverFilter();
  threeCanvasRef.value?.focusWorkshop(workshopId);
}

function handleFocusWarehouse(warehouseId: string) {
  const warehouse = warehouseModel.getWarehouseById(warehouseId);
  if (!warehouse) return;
  selectedWarehouseId.value = warehouseId;
  const workshop = WORKSHOPS.find((item) => item.id === warehouse.workshopId);
  if (workshop) selectedWorkshop.value = workshop;
  threeCanvasRef.value?.focusWarehouse(warehouseId);
}

function handleTurnoverFilter(classKey: TurnoverClass) {
  turnoverFilter.value = classKey;
  threeCanvasRef.value?.applyTurnoverFilter(classKey);
}

function clearTurnoverFilter() {
  turnoverFilter.value = null;
  threeCanvasRef.value?.applyTurnoverFilter(null);
}

function handleAgvCaseChange(caseId: AgvCaseId) {
  agvModel.setCase(caseId);
  agvPlaying.value = true;
}

function handleAgvStrategyChange(key: AgvStrategyKey, value: boolean) {
  agvModel.setStrategy(key, value);
  agvPlaying.value = true;
}

function handleDispatch() {
  // 终端组件内部已有逐条反馈日志，此处可对接后端
}
</script>

<style scoped>
.screen {
  height: 100%;
  display: grid;
  grid-template-rows: 60px 1fr 40px;
  gap: 10px;
  color: var(--text-primary);
  padding: 10px;
}

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--panel-bg);
  border: var(--panel-border);
  border-radius: var(--panel-radius);
  box-shadow: var(--shadow-sm);
  padding: 0 24px;
  animation: fadeSlideUp 0.4s ease-out both;
}

h1 {
  margin: 0;
  font-size: 18px;
  letter-spacing: 1px;
  font-weight: 700;
  color: var(--c-primary);
}

.badge {
  font-size: 12px;
  color: var(--c-cyan);
  padding: 4px 12px;
  background: rgba(8, 145, 178, 0.08);
  border: 1px solid rgba(8, 145, 178, 0.25);
  border-radius: 6px;
}

.content-grid {
  min-height: 0;
  display: grid;
  grid-template-columns: 220px 1fr 400px;
  gap: 10px;
}

.center-column {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  min-width: 0;
}

.scene-panel {
  flex: 1;
  border: var(--panel-border);
  border-radius: var(--panel-radius);
  overflow: hidden;
  background: var(--panel-bg);
  box-shadow: var(--shadow-sm);
  min-width: 0;
  min-height: 0;
  animation: fadeSlideUp 0.4s ease-out 0.05s both;
  display: flex;
  flex-direction: column;
}

.adjust-terminal {
  flex-shrink: 0;
  height: 200px;
  animation: fadeSlideUp 0.3s ease-out both;
}

.scene-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-default);
  background: var(--bg-inset);
}

.scene-toolbar__label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 600;
}

.scene-toolbar__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.scene-toolbar__btn {
  padding: 6px 12px;
  font-size: 12px;
  border: 1px solid var(--border-default);
  border-radius: 6px;
  background: #ffffff;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.scene-toolbar__btn:hover {
  border-color: var(--border-active);
  background: var(--c-primary-light);
  color: var(--c-primary);
}

.scene-toolbar__btn.active {
  border-color: var(--border-active);
  background: var(--c-primary-light);
  color: var(--c-primary);
  font-weight: 600;
}

.scene-canvas-wrap {
  flex: 1;
  min-height: 0;
}

.bottom-bar {
  display: flex;
  align-items: center;
  justify-content: space-around;
  font-size: 13px;
  border: var(--panel-border);
  border-radius: var(--panel-radius);
  background: var(--panel-bg);
  box-shadow: var(--shadow-sm);
  color: var(--text-secondary);
  animation: fadeSlideUp 0.4s ease-out 0.15s both;
}

.bottom-bar span {
  position: relative;
  padding: 0 12px;
}

.bottom-bar span + span::before {
  content: "";
  position: absolute;
  left: 0;
  top: 25%;
  bottom: 25%;
  width: 1px;
  background: var(--border-default);
}

@media (max-width: 1480px) {
  .content-grid {
    grid-template-columns: 200px 1fr 380px;
  }
}

@media (max-width: 1180px) {
  .screen {
    grid-template-rows: auto 1fr auto;
  }
  .content-grid {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(420px, 1fr) auto;
  }
}
</style>
