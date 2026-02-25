export interface WorkshopKpi {
  inventoryTons: number;
  inventoryAmountWan: number;
  turnoverRate: number;
  stagnantRate: number;
}

export interface WorkshopInfo {
  id: string;
  name: string;
  areaM2: number;
  manager: string;
  relatedWarehouseCount: number;
  staffCount: number;
  status: "normal" | "busy" | "warning";
  anchor: {
    x: number;
    y: number;
    z: number;
  };
  kpi: WorkshopKpi;
  description: string;
}

export interface NavItem {
  key: string;
  label: string;
}
