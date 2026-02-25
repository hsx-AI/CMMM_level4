import type { TurnoverClass } from "@/types/warehouse";

const SAFE_EPSILON = 1e-6;

/**
 * 库存金额 = 库存数量 * 单价
 */
export function calcInventoryAmount(inventoryQty: number, unitPrice: number): number {
  return inventoryQty * unitPrice;
}

/**
 * 仓库占用率 = 当前库存 / 仓库容量
 */
export function calcOccupancyRate(inventoryQty: number, capacity: number): number {
  if (capacity <= SAFE_EPSILON) return 0;
  return (inventoryQty / capacity) * 100;
}

/**
 * 周转率 = 期间出库总量 / 期间平均库存
 */
export function calcTurnoverRate(totalOutboundQty: number, avgInventoryQty: number): number {
  if (avgInventoryQty <= SAFE_EPSILON) return 0;
  return totalOutboundQty / avgInventoryQty;
}

/**
 * 周转天数 = 期间天数 / 周转率
 */
export function calcTurnoverDays(periodDays: number, turnoverRate: number): number {
  if (turnoverRate <= SAFE_EPSILON) return 0;
  return periodDays / turnoverRate;
}

/**
 * 呆滞占比 = 呆滞库存 / 当前库存
 */
export function calcStagnantRatio(stagnantQty: number, inventoryQty: number): number {
  if (inventoryQty <= SAFE_EPSILON) return 0;
  return (stagnantQty / inventoryQty) * 100;
}

export function round(value: number, digits = 2): number {
  const base = 10 ** digits;
  return Math.round(value * base) / base;
}

export function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((acc, cur) => acc + cur, 0) / values.length;
}

export function sum(values: number[]): number {
  return values.reduce((acc, cur) => acc + cur, 0);
}

export function resolveTurnoverClass(turnoverDays: number): TurnoverClass {
  if (turnoverDays <= 18) return "fast";
  if (turnoverDays <= 35) return "balanced";
  return "slow";
}

export function turnoverClassLabel(classKey: TurnoverClass): string {
  if (classKey === "fast") return "高周转";
  if (classKey === "balanced") return "中周转";
  return "低周转";
}
