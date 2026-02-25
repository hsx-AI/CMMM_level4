export type DateGranularity = "day" | "week" | "month";
export type TurnoverClass = "fast" | "balanced" | "slow";

export interface WarehouseStaticConfig {
  id: string;
  workshopId: string;
  name: string;
  manager: string;
  capacity: number;
  unitPrice: number;
  initialInventory: number;
  baseInbound: number;
  baseOutbound: number;
  volatility: number;
  stagnantRisk: number;
  locationOffset: {
    x: number;
    z: number;
  };
}

export interface MaterialConfig {
  code: string;
  name: string;
  priceFactor: number;
  riskWeight: number;
}

export interface WarehouseDailyRecord {
  date: string;
  inbound: number;
  outbound: number;
  inventory: number;
  stagnantQty: number;
}

export interface WarehouseRuntime extends WarehouseStaticConfig {
  workshopName: string;
  worldPosition: {
    x: number;
    y: number;
    z: number;
  };
  currentInventory: number;
  currentAmount: number;
  occupancyRate: number;
  stagnantRatio: number;
  turnoverRate: number;
  turnoverDays: number;
  turnoverClass: TurnoverClass;
}

export interface FlowPoint {
  label: string;
  inbound: number;
  outbound: number;
}

export interface TurnoverClassStat {
  classKey: TurnoverClass;
  classLabel: string;
  warehouseCount: number;
  avgTurnoverRate: number;
  avgTurnoverDays: number;
}

export interface StagnantTopItem {
  rank: number;
  warehouseId: string;
  warehouseName: string;
  materialCode: string;
  materialName: string;
  stagnantQty: number;
  stagnantDays: number;
  stagnantAmount: number;
}
