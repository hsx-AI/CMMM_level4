import { computed, ref } from "vue";
import caseConfig from "@/mock/agv/cases.json";
import networkConfig from "@/mock/agv/network.json";
import taskConfig from "@/mock/agv/tasks.json";
import congestionConfig from "@/mock/agv/congestion.json";
import { runAgvCase } from "@/utils/agvPlanner";
import type {
  AgvCaseId,
  AgvCaseMeta,
  AgvCaseRunResult,
  AgvEdge,
  AgvNode,
  AgvStrategyConfig,
  AgvTask,
  CongestionRecord
} from "@/types/agv";

const DEFAULT_STRATEGY: AgvStrategyConfig = {
  nearest: true,
  avoidCongestion: true,
  mergeTask: true,
  timeWindow: true
};

export function useAgvModel() {
  const nodes = networkConfig.nodes as AgvNode[];
  const edges = networkConfig.edges as AgvEdge[];
  const cases = caseConfig.cases as AgvCaseMeta[];
  const tasks = taskConfig.tasks as AgvTask[];
  const congestion = congestionConfig.records as CongestionRecord[];

  const activeCaseId = ref<AgvCaseId>("caseA");
  const strategy = ref<AgvStrategyConfig>({ ...DEFAULT_STRATEGY });

  const activeCase = computed(() => cases.find((item) => item.id === activeCaseId.value) ?? cases[0]);
  const caseTasks = computed(() => tasks.filter((task) => task.caseId === activeCase.value.id));

  const result = computed<AgvCaseRunResult>(() =>
    runAgvCase({
      nodes,
      edges,
      congestion,
      caseMeta: activeCase.value,
      tasks: caseTasks.value,
      strategy: strategy.value
    })
  );

  function setCase(caseId: AgvCaseId) {
    activeCaseId.value = caseId;
  }

  function setStrategy(key: keyof AgvStrategyConfig, value: boolean) {
    strategy.value = {
      ...strategy.value,
      [key]: value
    };
  }

  function resetStrategy() {
    strategy.value = { ...DEFAULT_STRATEGY };
  }

  return {
    cases,
    activeCaseId,
    activeCase,
    strategy,
    result,
    setCase,
    setStrategy,
    resetStrategy
  };
}
