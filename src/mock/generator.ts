import warehouseConfig from "@/mock/warehouse/warehouses.json";
import profileConfig from "@/mock/warehouse/profiles.json";
import defaultRange from "@/mock/warehouse/default-range.json";
import type {
  MaterialConfig,
  StagnantTopItem,
  WarehouseDailyRecord,
  WarehouseStaticConfig
} from "@/types/warehouse";
import { calcInventoryAmount, round } from "@/utils/kpi";

export interface GeneratorOptions {
  startDate?: string;
  endDate?: string;
  seed?: number;
}

export interface WarehouseGeneratedData {
  seed: number;
  startDate: string;
  endDate: string;
  recordsByWarehouse: Record<string, WarehouseDailyRecord[]>;
  stagnantTopByWarehouse: Record<string, StagnantTopItem[]>;
}

interface Profiles {
  weekdayFactor: number[];
  monthFactor: number[];
  materialPool: MaterialConfig[];
}

const profiles = profileConfig as Profiles;
const warehouses = warehouseConfig.warehouses as WarehouseStaticConfig[];

export function getWarehouseConfigList(): WarehouseStaticConfig[] {
  return warehouses;
}

export function getDefaultGeneratorOptions(): Required<GeneratorOptions> {
  return {
    startDate: defaultRange.startDate,
    endDate: defaultRange.endDate,
    seed: defaultRange.seed
  };
}

export function generateWarehouseData(options: GeneratorOptions = {}): WarehouseGeneratedData {
  const defaults = getDefaultGeneratorOptions();
  const startDate = options.startDate ?? defaults.startDate;
  const endDate = options.endDate ?? defaults.endDate;
  const seed = options.seed ?? defaults.seed;
  const dateList = enumerateDates(startDate, endDate);
  const baseRandom = createRandom(seed);

  const recordsByWarehouse: Record<string, WarehouseDailyRecord[]> = {};
  const stagnantTopByWarehouse: Record<string, StagnantTopItem[]> = {};

  warehouses.forEach((warehouse, index) => {
    const warehouseSeed = Math.floor(baseRandom() * 1_000_000 + index * 97);
    const random = createRandom(warehouseSeed);
    const records = generateWarehouseRecords(warehouse, dateList, random);
    recordsByWarehouse[warehouse.id] = records;
    stagnantTopByWarehouse[warehouse.id] = generateStagnantTop(
      warehouse,
      records[records.length - 1],
      random
    );
  });

  return {
    seed,
    startDate,
    endDate,
    recordsByWarehouse,
    stagnantTopByWarehouse
  };
}

function generateWarehouseRecords(
  warehouse: WarehouseStaticConfig,
  dateList: string[],
  random: () => number
): WarehouseDailyRecord[] {
  let inventory = warehouse.initialInventory;
  let stagnantQty = Math.max(warehouse.initialInventory * warehouse.stagnantRisk * 0.35, 20);

  return dateList.map((dateText) => {
    const date = new Date(`${dateText}T00:00:00`);
    const weekFactor = profiles.weekdayFactor[date.getDay()] ?? 1;
    const monthFactor = profiles.monthFactor[date.getMonth()] ?? 1;
    const randomFactorIn = 1 + (random() * 2 - 1) * warehouse.volatility;
    const randomFactorOut = 1 + (random() * 2 - 1) * warehouse.volatility;

    const inbound = Math.max(
      0,
      Math.round(warehouse.baseInbound * weekFactor * monthFactor * randomFactorIn)
    );
    const outboundTarget = warehouse.baseOutbound * weekFactor * monthFactor * randomFactorOut;
    const outbound = Math.max(0, Math.round(Math.min(outboundTarget, inventory + inbound * 0.95)));

    inventory = Math.max(0, Math.min(warehouse.capacity * 1.05, inventory + inbound - outbound));

    const stagnantIncrement = inbound * warehouse.stagnantRisk * (0.05 + random() * 0.04);
    const stagnantRelease = outbound * (0.018 + random() * 0.012);
    stagnantQty = Math.max(0, Math.min(inventory, stagnantQty + stagnantIncrement - stagnantRelease));

    return {
      date: dateText,
      inbound,
      outbound,
      inventory: round(inventory, 0),
      stagnantQty: round(stagnantQty, 0)
    };
  });
}

function generateStagnantTop(
  warehouse: WarehouseStaticConfig,
  latestRecord: WarehouseDailyRecord,
  random: () => number
): StagnantTopItem[] {
  const baseStagnant = Math.max(1, latestRecord.stagnantQty);
  const materialPool = [...profiles.materialPool];
  const result: StagnantTopItem[] = [];

  for (let i = 0; i < 10; i += 1) {
    const poolIndex = Math.floor(random() * materialPool.length);
    const material = materialPool[poolIndex] ?? profiles.materialPool[i % profiles.materialPool.length];
    const qtyRatio = 0.05 + random() * 0.18 + material.riskWeight * 0.1;
    const stagnantQty = Math.max(1, Math.round(baseStagnant * qtyRatio));
    const stagnantDays = Math.round(35 + material.riskWeight * 60 + random() * 90);
    const stagnantAmount = calcInventoryAmount(
      stagnantQty,
      warehouse.unitPrice * material.priceFactor
    );

    result.push({
      rank: i + 1,
      warehouseId: warehouse.id,
      warehouseName: warehouse.name,
      materialCode: material.code,
      materialName: material.name,
      stagnantQty,
      stagnantDays,
      stagnantAmount: round(stagnantAmount, 2)
    });
  }

  return result.sort((a, b) => b.stagnantAmount - a.stagnantAmount).map((item, index) => ({
    ...item,
    rank: index + 1
  }));
}

function enumerateDates(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const dates: string[] = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
