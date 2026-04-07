import type { NavItem, WorkshopInfo } from "@/types/workshop";

export const SCREEN_TITLE = "电机公司仓储物流自适应优化系统";

export const NAV_ITEMS: NavItem[] = [
  { key: "overview", label: "厂区总览" },
  { key: "warehouse", label: "仓储配置自适应优化" },
  { key: "agv", label: "AGV配送策略自适应优化" }
];

export const DEFAULT_WORKSHOP_ID = "company_level1_warehouse";

export const WORKSHOPS: WorkshopInfo[] = [
  {
    id: "coil_factory",
    name: "线圈分厂",
    areaM2: 15600,
    manager: "李思源",
    relatedWarehouseCount: 4,
    staffCount: 112,
    status: "busy",
    anchor: { x: -55, y: 6, z: -20 },
    description: "负责线圈卷材入厂检验、分拣及预加工。",
    kpi: {
      inventoryTons: 2860,
      inventoryAmountWan: 20680,
      turnoverRate: 7.8,
      stagnantRate: 3.4
    }
  },
  {
    id: "stamping_cutting_factory",
    name: "冲剪分厂",
    areaM2: 13200,
    manager: "王泽民",
    relatedWarehouseCount: 3,
    staffCount: 96,
    status: "normal",
    anchor: { x: 5, y: 6, z: -12 },
    description: "承担板材冲压、裁切与质量复检。",
    kpi: {
      inventoryTons: 1940,
      inventoryAmountWan: 13250,
      turnoverRate: 8.3,
      stagnantRate: 2.6
    }
  },
  {
    id: "utilities_workshop",
    name: "水电分厂",
    areaM2: 6400,
    manager: "赵清华",
    relatedWarehouseCount: 2,
    staffCount: 44,
    status: "warning",
    anchor: { x: 64, y: 6, z: 18 },
    description: "保障全厂水、电、气和动力设备稳定运行，承担配电变电及给排水管理。",
    kpi: {
      inventoryTons: 620,
      inventoryAmountWan: 13230,
      turnoverRate: 4.9,
      stagnantRate: 5.8
    }
  },
  {
    id: "company_level1_warehouse",
    name: "公司一级库",
    areaM2: 9800,
    manager: "刘建国",
    relatedWarehouseCount: 4,
    staffCount: 68,
    status: "normal",
    anchor: { x: 80, y: 6, z: -40 },
    description: "公司级集中仓储，涵盖有色库、五金一级库等，负责大宗原材料集中收储与调拨。",
    kpi: {
      inventoryTons: 4250,
      inventoryAmountWan: 32160,
      turnoverRate: 5.2,
      stagnantRate: 4.1
    }
  }
];

export const STATUS_TEXT_MAP: Record<WorkshopInfo["status"], string> = {
  normal: "正常",
  busy: "高负荷",
  warning: "预警"
};
