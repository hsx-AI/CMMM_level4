import type {
  AgvCaseMeta,
  AgvCaseRunResult,
  AgvEdge,
  AgvKpiResult,
  AgvNode,
  AgvStrategyConfig,
  AgvTask,
  CongestionRecord,
  PathResult,
  ScheduledTask
} from "@/types/agv";

const AGV_IDS = ["AGV-01", "AGV-02", "AGV-03"];
const SPEED_DISTANCE_PER_MIN = 3.2;

interface PlannerInput {
  nodes: AgvNode[];
  edges: AgvEdge[];
  congestion: CongestionRecord[];
  caseMeta: AgvCaseMeta;
  tasks: AgvTask[];
  strategy: AgvStrategyConfig;
}

interface AgvRuntimeState {
  agvId: string;
  currentNode: string;
  timeMin: number;
  loadedDistance: number;
  emptyDistance: number;
  waitingMin: number;
}

interface AdjacencyItem {
  to: string;
  edgeId: string;
  distance: number;
}

interface GraphContext {
  nodeMap: Map<string, AgvNode>;
  edgeMap: Map<string, AgvEdge>;
  adjacency: Map<string, AdjacencyItem[]>;
  congestionMap: Map<string, number>;
}

export function runAgvCase(input: PlannerInput): AgvCaseRunResult {
  const graph = createGraphContext(input.nodes, input.edges, input.congestion, input.caseMeta.startHour);
  const logs: string[] = [];
  const orderedTasks = reorderTasks(input.tasks, graph, input.caseMeta.depotNode, input.strategy);
  const scheduledTasks = scheduleTasks(orderedTasks, graph, input.caseMeta, input.strategy, logs);

  const kpi = calcKpi(scheduledTasks, input.caseMeta.startHour);
  const beforeLines = scheduledTasks.map((task) => ({
    taskId: task.id,
    points: toPoints(task.beforePath.nodes, graph.nodeMap)
  }));
  const afterLines = scheduledTasks.map((task) => ({
    taskId: task.id,
    points: toPoints(task.afterPath.nodes, graph.nodeMap)
  }));
  const agvRoutes = buildAgvRoutes(scheduledTasks, graph.nodeMap);

  return {
    caseMeta: input.caseMeta,
    strategy: input.strategy,
    tasks: scheduledTasks,
    kpi,
    logs,
    beforeLines,
    afterLines,
    agvRoutes
  };
}

function createGraphContext(
  nodes: AgvNode[],
  edges: AgvEdge[],
  congestion: CongestionRecord[],
  hour: number
): GraphContext {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const edgeMap = new Map(edges.map((edge) => [edge.id, edge]));
  const adjacency = new Map<string, AdjacencyItem[]>();
  const congestionMap = new Map<string, number>();

  congestion
    .filter((item) => item.hour === hour)
    .forEach((item) => congestionMap.set(item.edgeId, item.heat));

  edges.forEach((edge) => {
    pushAdjacency(adjacency, edge.from, { to: edge.to, edgeId: edge.id, distance: edge.distance });
    if (edge.bidirectional) {
      pushAdjacency(adjacency, edge.to, { to: edge.from, edgeId: edge.id, distance: edge.distance });
    }
  });

  return { nodeMap, edgeMap, adjacency, congestionMap };
}

function reorderTasks(
  tasks: AgvTask[],
  graph: GraphContext,
  depotNode: string,
  strategy: AgvStrategyConfig
): AgvTask[] {
  const base = [...tasks].sort((a, b) => toMinutes(a.timeWindowStart) - toMinutes(b.timeWindowStart));
  if (!strategy.nearest) return base;

  const pending = [...base];
  const result: AgvTask[] = [];
  let currentNode = depotNode;
  while (pending.length) {
    pending.sort((a, b) => {
      const da = shortestDistanceOnly(currentNode, a.from, graph);
      const db = shortestDistanceOnly(currentNode, b.from, graph);
      return da - db || b.priority - a.priority;
    });
    const next = pending.shift();
    if (!next) break;
    result.push(next);
    currentNode = next.to;
  }
  return result;
}

function scheduleTasks(
  tasks: AgvTask[],
  graph: GraphContext,
  caseMeta: AgvCaseMeta,
  strategy: AgvStrategyConfig,
  logs: string[]
): ScheduledTask[] {
  const agvStates: AgvRuntimeState[] = AGV_IDS.map((agvId) => ({
    agvId,
    currentNode: caseMeta.depotNode,
    timeMin: caseMeta.startHour * 60,
    loadedDistance: 0,
    emptyDistance: 0,
    waitingMin: 0
  }));

  const scheduled: ScheduledTask[] = [];
  let nextRoundRobin = 0;
  const mergeCache = new Map<string, { agvId: string; finishedMin: number }>();

  for (const task of tasks) {
    const beforePath = dijkstraPath(task.from, task.to, graph, false);
    const afterPath = dijkstraPath(task.from, task.to, graph, strategy.avoidCongestion);
    const selectedAgv = selectAgvForTask(
      task,
      agvStates,
      graph,
      strategy,
      nextRoundRobin,
      beforePath,
      afterPath
    );
    if (!strategy.timeWindow) {
      nextRoundRobin = (nextRoundRobin + 1) % agvStates.length;
    }

    const beforeEmpty = dijkstraPath(selectedAgv.currentNode, task.from, graph, false);
    const afterEmpty = dijkstraPath(selectedAgv.currentNode, task.from, graph, strategy.avoidCongestion);

    const startWindow = toMinutes(task.timeWindowStart);
    const endWindow = toMinutes(task.timeWindowEnd);

    const useAfterLoaded = afterPath;
    const useAfterEmpty = afterEmpty;
    let emptyDistance = useAfterEmpty.distance;
    let mergedCount = 1;

    if (strategy.mergeTask) {
      const key = `${task.from}->${task.to}`;
      const prev = mergeCache.get(key);
      if (prev && prev.agvId === selectedAgv.agvId && Math.abs(prev.finishedMin - selectedAgv.timeMin) < 20) {
        emptyDistance *= 0.3;
        mergedCount = 2;
      }
      mergeCache.set(key, { agvId: selectedAgv.agvId, finishedMin: selectedAgv.timeMin });
    }

    const driveMin = (emptyDistance + useAfterLoaded.distance) / SPEED_DISTANCE_PER_MIN;
    const arrivalAtWindow = selectedAgv.timeMin + emptyDistance / SPEED_DISTANCE_PER_MIN;
    const earlyWait = Math.max(0, startWindow - arrivalAtWindow);
    const latePenalty = Math.max(0, arrivalAtWindow - endWindow);
    const congestionWaitFactor = strategy.avoidCongestion ? 0.45 : 1.2;
    const congestionWait = useAfterLoaded.edges.reduce((acc, edgeId) => {
      const heat = graph.congestionMap.get(edgeId) ?? 0;
      return acc + heat * 1.2 * congestionWaitFactor;
    }, 0);
    const waitMinutes = earlyWait + latePenalty * (strategy.timeWindow ? 0.2 : 0.8) + congestionWait;

    selectedAgv.currentNode = task.to;
    selectedAgv.timeMin += driveMin + waitMinutes;
    selectedAgv.emptyDistance += emptyDistance;
    selectedAgv.loadedDistance += useAfterLoaded.distance;
    selectedAgv.waitingMin += waitMinutes;

    const avoided = beforePath.edges.filter((edgeId) => {
      const heat = graph.congestionMap.get(edgeId) ?? 0;
      return heat > 0.72 && !useAfterLoaded.edges.includes(edgeId);
    });
    useAfterLoaded.heatAvoidedEdges = avoided;

    logs.push(
      [
        `[${task.id}] ${selectedAgv.agvId}`,
        `baseline=${beforePath.distance.toFixed(1)}m`,
        `optimized=${useAfterLoaded.distance.toFixed(1)}m`,
        `wait=${waitMinutes.toFixed(1)}min`,
        avoided.length ? `avoid=${avoided.join(",")}` : "avoid=none"
      ].join(" | ")
    );

    scheduled.push({
      ...task,
      agvId: selectedAgv.agvId,
      startNode: selectedAgv.currentNode,
      emptyDistance: round2(emptyDistance),
      loadedDistance: round2(useAfterLoaded.distance),
      waitMinutes: round2(waitMinutes),
      mergedCount,
      beforePath,
      afterPath: useAfterLoaded
    });
  }

  return scheduled;
}

function selectAgvForTask(
  task: AgvTask,
  agvStates: AgvRuntimeState[],
  graph: GraphContext,
  strategy: AgvStrategyConfig,
  roundRobinIndex: number,
  beforePath: PathResult,
  afterPath: PathResult
): AgvRuntimeState {
  if (!strategy.timeWindow && !strategy.nearest) {
    return agvStates[roundRobinIndex];
  }

  const targetWindowStart = toMinutes(task.timeWindowStart);
  let best = agvStates[0];
  let bestScore = Number.POSITIVE_INFINITY;

  for (const state of agvStates) {
    const approach = dijkstraPath(state.currentNode, task.from, graph, strategy.avoidCongestion);
    const baseDistance = strategy.avoidCongestion ? afterPath.distance : beforePath.distance;
    const arrival = state.timeMin + (approach.distance + baseDistance) / SPEED_DISTANCE_PER_MIN;
    const lateness = Math.max(0, arrival - targetWindowStart);
    const score =
      approach.distance +
      baseDistance +
      lateness * (strategy.timeWindow ? 0.35 : 0.1) +
      state.waitingMin * 0.15;

    if (score < bestScore) {
      best = state;
      bestScore = score;
    }
  }

  return best;
}

function calcKpi(tasks: ScheduledTask[], startHour: number): AgvKpiResult {
  const loadedBefore = sum(tasks.map((item) => item.beforePath.distance));
  const loadedAfter = sum(tasks.map((item) => item.loadedDistance));
  const emptyBefore = sum(tasks.map((item) => item.beforePath.distance * 0.36));
  const emptyAfter = sum(tasks.map((item) => item.emptyDistance));
  const waitingBefore = sum(
    tasks.map((item) => {
      const highHeatCost = item.beforePath.edges.length * 0.7;
      return item.waitMinutes + highHeatCost + (item.mergedCount > 1 ? 4 : 0);
    })
  );
  const waitingAfter = sum(tasks.map((item) => item.waitMinutes));

  const totalDistanceBefore = loadedBefore + emptyBefore;
  const totalDistanceAfter = loadedAfter + emptyAfter;
  const totalDurationBefore = totalDistanceBefore / SPEED_DISTANCE_PER_MIN + waitingBefore;
  const totalDurationAfter = totalDistanceAfter / SPEED_DISTANCE_PER_MIN + waitingAfter;

  const emptyRateBefore = safePercent(emptyBefore, totalDistanceBefore);
  const emptyRateAfter = safePercent(emptyAfter, totalDistanceAfter);
  const utilizationBefore = safePercent(loadedBefore, totalDistanceBefore + waitingBefore);
  const utilizationAfter = safePercent(loadedAfter, totalDistanceAfter + waitingAfter);
  const mergeRate = safePercent(
    tasks.filter((task) => task.mergedCount > 1).length,
    Math.max(tasks.length, 1)
  );

  return {
    totalDistanceBefore: round2(totalDistanceBefore),
    totalDistanceAfter: round2(totalDistanceAfter),
    totalDurationBefore: round2(totalDurationBefore),
    totalDurationAfter: round2(totalDurationAfter),
    emptyRateBefore: round2(emptyRateBefore),
    emptyRateAfter: round2(emptyRateAfter),
    waitingMinutesBefore: round2(waitingBefore),
    waitingMinutesAfter: round2(waitingAfter),
    mergeRate: round2(mergeRate),
    utilizationBefore: round2(utilizationBefore),
    utilizationAfter: round2(utilizationAfter)
  };
}

function dijkstraPath(
  from: string,
  to: string,
  graph: GraphContext,
  avoidCongestion: boolean
): PathResult {
  if (from === to) {
    return { nodes: [from], edges: [], distance: 0, weightedCost: 0, heatAvoidedEdges: [] };
  }

  const dist = new Map<string, number>();
  const prevNode = new Map<string, string>();
  const prevEdge = new Map<string, string>();
  const visited = new Set<string>();
  const queue = new Set<string>();

  dist.set(from, 0);
  queue.add(from);

  while (queue.size) {
    let current: string | null = null;
    let minDist = Number.POSITIVE_INFINITY;
    for (const nodeId of queue) {
      const d = dist.get(nodeId) ?? Number.POSITIVE_INFINITY;
      if (d < minDist) {
        minDist = d;
        current = nodeId;
      }
    }
    if (!current) break;
    queue.delete(current);
    if (current === to) break;
    if (visited.has(current)) continue;
    visited.add(current);

    const neighbors = graph.adjacency.get(current) ?? [];
    for (const neighbor of neighbors) {
      const heat = graph.congestionMap.get(neighbor.edgeId) ?? 0;
      const weight = avoidCongestion
        ? neighbor.distance * (1 + heat * 1.7) + (heat > 0.8 ? 9 : 0)
        : neighbor.distance;
      const nd = minDist + weight;
      if (nd < (dist.get(neighbor.to) ?? Number.POSITIVE_INFINITY)) {
        dist.set(neighbor.to, nd);
        prevNode.set(neighbor.to, current);
        prevEdge.set(neighbor.to, neighbor.edgeId);
        queue.add(neighbor.to);
      }
    }
  }

  const nodes: string[] = [];
  const edges: string[] = [];
  let cursor: string | undefined = to;
  while (cursor) {
    nodes.push(cursor);
    const p = prevNode.get(cursor);
    const e = prevEdge.get(cursor);
    if (e) edges.push(e);
    cursor = p;
    if (cursor === from) {
      nodes.push(cursor);
      break;
    }
  }
  nodes.reverse();
  edges.reverse();

  const pureDistance = sum(
    edges.map((edgeId) => {
      const edge = graph.edgeMap.get(edgeId);
      return edge ? edge.distance : 0;
    })
  );

  return {
    nodes: nodes.length ? nodes : [from, to],
    edges,
    distance: round2(pureDistance),
    weightedCost: round2(dist.get(to) ?? pureDistance),
    heatAvoidedEdges: []
  };
}

function shortestDistanceOnly(from: string, to: string, graph: GraphContext): number {
  return dijkstraPath(from, to, graph, false).distance;
}

function buildAgvRoutes(tasks: ScheduledTask[], nodeMap: Map<string, AgvNode>) {
  const byAgv = new Map<string, ScheduledTask[]>();
  tasks.forEach((task) => {
    if (!byAgv.has(task.agvId)) byAgv.set(task.agvId, []);
    byAgv.get(task.agvId)?.push(task);
  });
  return [...byAgv.entries()].map(([agvId, list]) => {
    const points: Array<{ x: number; y: number; z: number }> = [];
    for (const task of list) {
      task.afterPath.nodes.forEach((nodeId) => {
        const node = nodeMap.get(nodeId);
        if (!node) return;
        points.push({ x: node.x, y: 1.6, z: node.z });
      });
    }
    return { agvId, points };
  });
}

function toPoints(nodes: string[], nodeMap: Map<string, AgvNode>) {
  return nodes
    .map((nodeId) => nodeMap.get(nodeId))
    .filter((node): node is AgvNode => !!node)
    .map((node) => ({ x: node.x, y: 0.5, z: node.z }));
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((item) => Number(item));
  return h * 60 + m;
}

function safePercent(part: number, total: number): number {
  if (total <= 0) return 0;
  return (part / total) * 100;
}

function sum(values: number[]): number {
  return values.reduce((acc, cur) => acc + cur, 0);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function pushAdjacency(
  adjacency: Map<string, AdjacencyItem[]>,
  from: string,
  item: AdjacencyItem
) {
  if (!adjacency.has(from)) adjacency.set(from, []);
  adjacency.get(from)?.push(item);
}
