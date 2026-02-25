export type AgvCaseId = "caseA" | "caseB" | "caseC";
export type AgvStrategyKey = "nearest" | "avoidCongestion" | "mergeTask" | "timeWindow";

export interface AgvNode {
  id: string;
  x: number;
  z: number;
  workshopId: string;
}

export interface AgvEdge {
  id: string;
  from: string;
  to: string;
  distance: number;
  bidirectional: boolean;
}

export interface AgvTask {
  id: string;
  caseId: AgvCaseId;
  from: string;
  to: string;
  materialType: string;
  priority: 1 | 2 | 3;
  timeWindowStart: string;
  timeWindowEnd: string;
  quantity: number;
}

export interface CongestionRecord {
  edgeId: string;
  hour: number;
  heat: number;
}

export interface AgvCaseMeta {
  id: AgvCaseId;
  title: string;
  workshopId: string;
  summary: string;
  focus: string[];
  startHour: number;
  depotNode: string;
}

export interface AgvStrategyConfig {
  nearest: boolean;
  avoidCongestion: boolean;
  mergeTask: boolean;
  timeWindow: boolean;
}

export interface PathResult {
  nodes: string[];
  edges: string[];
  distance: number;
  weightedCost: number;
  heatAvoidedEdges: string[];
}

export interface ScheduledTask extends AgvTask {
  agvId: string;
  startNode: string;
  emptyDistance: number;
  loadedDistance: number;
  waitMinutes: number;
  mergedCount: number;
  beforePath: PathResult;
  afterPath: PathResult;
}

export interface AgvKpiResult {
  totalDistanceBefore: number;
  totalDistanceAfter: number;
  totalDurationBefore: number;
  totalDurationAfter: number;
  emptyRateBefore: number;
  emptyRateAfter: number;
  waitingMinutesBefore: number;
  waitingMinutesAfter: number;
  mergeRate: number;
  utilizationBefore: number;
  utilizationAfter: number;
}

export interface AgvCaseRunResult {
  caseMeta: AgvCaseMeta;
  strategy: AgvStrategyConfig;
  tasks: ScheduledTask[];
  kpi: AgvKpiResult;
  logs: string[];
  beforeLines: Array<{ taskId: string; points: Array<{ x: number; y: number; z: number }> }>;
  afterLines: Array<{ taskId: string; points: Array<{ x: number; y: number; z: number }> }>;
  agvRoutes: Array<{ agvId: string; points: Array<{ x: number; y: number; z: number }> }>;
}
