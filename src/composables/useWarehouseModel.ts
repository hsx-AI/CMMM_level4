import type { WorkshopInfo } from "@/types/workshop";
import type {
  DateGranularity,
  FlowPoint,
  StagnantTopItem,
  TurnoverClass,
  TurnoverClassStat,
  WarehouseDailyRecord,
  WarehouseRuntime
} from "@/types/warehouse";
import {
  generateWarehouseData,
  getDefaultGeneratorOptions,
  getWarehouseConfigList
} from "@/mock/generator";
import {
  average,
  calcInventoryAmount,
  calcOccupancyRate,
  calcStagnantRatio,
  calcTurnoverDays,
  calcTurnoverRate,
  resolveTurnoverClass,
  round,
  sum,
  turnoverClassLabel
} from "@/utils/kpi";

const PERIOD_DAYS = 30;

export function useWarehouseModel(workshops: WorkshopInfo[]) {
  const workshopMap = new Map(workshops.map((item) => [item.id, item]));
  const warehouseConfig = getWarehouseConfigList();
  const seedInfo = getDefaultGeneratorOptions();
  const generated = generateWarehouseData(seedInfo);

  const allWarehouses: WarehouseRuntime[] = warehouseConfig.map((warehouse) => {
    const workshop = workshopMap.get(warehouse.workshopId);
    const records = generated.recordsByWarehouse[warehouse.id] ?? [];
    const latest = records[records.length - 1] ?? {
      inventory: warehouse.initialInventory,
      stagnantQty: warehouse.initialInventory * warehouse.stagnantRisk
    };
    const recentRecords = records.slice(-PERIOD_DAYS);
    const avgInventory = average(recentRecords.map((item) => item.inventory));
    const totalOutbound = sum(recentRecords.map((item) => item.outbound));
    const turnoverRate = calcTurnoverRate(totalOutbound, avgInventory);
    const turnoverDays = calcTurnoverDays(PERIOD_DAYS, turnoverRate);
    const currentAmount = calcInventoryAmount(latest.inventory, warehouse.unitPrice);
    const occupancyRate = calcOccupancyRate(latest.inventory, warehouse.capacity);
    const stagnantRatio = calcStagnantRatio(latest.stagnantQty, latest.inventory);

    return {
      ...warehouse,
      workshopName: workshop?.name ?? warehouse.workshopId,
      worldPosition: {
        x: (workshop?.anchor.x ?? 0) + warehouse.locationOffset.x,
        y: 2.5,
        z: (workshop?.anchor.z ?? 0) + warehouse.locationOffset.z
      },
      currentInventory: latest.inventory,
      currentAmount: round(currentAmount, 2),
      occupancyRate: round(occupancyRate, 2),
      stagnantRatio: round(stagnantRatio, 2),
      turnoverRate: round(turnoverRate, 2),
      turnoverDays: round(turnoverDays, 2),
      turnoverClass: resolveTurnoverClass(turnoverDays)
    };
  });

  function getWarehousesByWorkshop(workshopId: string): WarehouseRuntime[] {
    return allWarehouses.filter((item) => item.workshopId === workshopId);
  }

  function getWarehouseById(warehouseId?: string | null): WarehouseRuntime | null {
    if (!warehouseId) return null;
    return allWarehouses.find((item) => item.id === warehouseId) ?? null;
  }

  function getDailyRecords(warehouseId: string): WarehouseDailyRecord[] {
    return generated.recordsByWarehouse[warehouseId] ?? [];
  }

  function getFlowSeriesByScope(
    workshopId: string,
    warehouseId: string | null,
    granularity: DateGranularity
  ): FlowPoint[] {
    const warehouseIds = warehouseId
      ? [warehouseId]
      : getWarehousesByWorkshop(workshopId).map((item) => item.id);

    const merged = mergeDailyRecords(warehouseIds.map((id) => getDailyRecords(id)));
    return aggregateFlowByGranularity(merged, granularity);
  }

  function getScopeSummary(workshopId: string, warehouseId: string | null) {
    const targetWarehouses = warehouseId
      ? allWarehouses.filter((item) => item.id === warehouseId)
      : getWarehousesByWorkshop(workshopId);

    const totalInventory = sum(targetWarehouses.map((item) => item.currentInventory));
    const totalAmount = sum(targetWarehouses.map((item) => item.currentAmount));
    const avgTurnoverRate = average(targetWarehouses.map((item) => item.turnoverRate));
    const avgTurnoverDays = average(targetWarehouses.map((item) => item.turnoverDays));
    const avgStagnantRatio = average(targetWarehouses.map((item) => item.stagnantRatio));

    return {
      totalInventory: round(totalInventory, 0),
      totalAmount: round(totalAmount, 2),
      avgTurnoverRate: round(avgTurnoverRate, 2),
      avgTurnoverDays: round(avgTurnoverDays, 2),
      avgStagnantRatio: round(avgStagnantRatio, 2)
    };
  }

  function getTurnoverClassStats(workshopId: string): TurnoverClassStat[] {
    const warehouseList = getWarehousesByWorkshop(workshopId);
    const groups: TurnoverClass[] = ["fast", "balanced", "slow"];
    return groups.map((classKey) => {
      const bucket = warehouseList.filter((item) => item.turnoverClass === classKey);
      return {
        classKey,
        classLabel: turnoverClassLabel(classKey),
        warehouseCount: bucket.length,
        avgTurnoverRate: round(average(bucket.map((item) => item.turnoverRate)), 2),
        avgTurnoverDays: round(average(bucket.map((item) => item.turnoverDays)), 2)
      };
    });
  }

  function getWarehousesByTurnoverClass(workshopId: string, classKey: TurnoverClass): WarehouseRuntime[] {
    return getWarehousesByWorkshop(workshopId).filter((item) => item.turnoverClass === classKey);
  }

  function getStagnantTop10(workshopId: string, warehouseId: string | null): StagnantTopItem[] {
    const warehouseIds = warehouseId
      ? [warehouseId]
      : getWarehousesByWorkshop(workshopId).map((item) => item.id);
    return warehouseIds
      .flatMap((id) => generated.stagnantTopByWarehouse[id] ?? [])
      .sort((a, b) => b.stagnantAmount - a.stagnantAmount)
      .slice(0, 10)
      .map((item, index) => ({ ...item, rank: index + 1 }));
  }

  return {
    seedInfo: {
      seed: generated.seed,
      startDate: generated.startDate,
      endDate: generated.endDate
    },
    allWarehouses,
    getWarehouseById,
    getWarehousesByWorkshop,
    getFlowSeriesByScope,
    getScopeSummary,
    getTurnoverClassStats,
    getWarehousesByTurnoverClass,
    getStagnantTop10
  };
}

function mergeDailyRecords(recordGroups: WarehouseDailyRecord[][]): WarehouseDailyRecord[] {
  const map = new Map<string, WarehouseDailyRecord>();
  for (const group of recordGroups) {
    for (const row of group) {
      const prev = map.get(row.date);
      if (!prev) {
        map.set(row.date, { ...row });
        continue;
      }
      prev.inbound += row.inbound;
      prev.outbound += row.outbound;
      prev.inventory += row.inventory;
      prev.stagnantQty += row.stagnantQty;
    }
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function aggregateFlowByGranularity(
  records: WarehouseDailyRecord[],
  granularity: DateGranularity
): FlowPoint[] {
  const map = new Map<string, { inbound: number; outbound: number }>();
  for (const row of records) {
    const key = formatGranularityKey(row.date, granularity);
    const entry = map.get(key) ?? { inbound: 0, outbound: 0 };
    entry.inbound += row.inbound;
    entry.outbound += row.outbound;
    map.set(key, entry);
  }
  return [...map.entries()].map(([label, value]) => ({
    label,
    inbound: round(value.inbound, 0),
    outbound: round(value.outbound, 0)
  }));
}

function formatGranularityKey(dateText: string, granularity: DateGranularity): string {
  const date = new Date(`${dateText}T00:00:00`);
  if (granularity === "day") {
    return dateText.slice(5);
  }
  if (granularity === "month") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
  const week = getWeekNumber(date);
  return `${date.getFullYear()}W${String(week).padStart(2, "0")}`;
}

function getWeekNumber(date: Date): number {
  const tempDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = tempDate.getUTCDay() || 7;
  tempDate.setUTCDate(tempDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
  return Math.ceil(((tempDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
