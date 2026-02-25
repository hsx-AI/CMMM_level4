/**
 * 仓储优化模型 composable
 * 基于电机公司水火电发电机生产特点，分析仓储现状并给出周转优化建议
 */
import { ref, computed } from "vue";
import type { WarehouseRuntime } from "@/types/warehouse";

export interface WarehouseCategory {
  id: string;
  label: string;
  warehouseIds: string[];
  description: string;
}

export interface OptKpi {
  label: string;
  before: number;
  after: number;
  unit: string;
  direction: "lower" | "higher";
}

export interface OptSuggestion {
  id: string;
  title: string;
  description: string;
  impact: string;
  priority: "high" | "medium" | "low";
  relatedWarehouses: string[];
}

export interface CategoryAnalysis {
  category: WarehouseCategory;
  totalInventory: number;
  totalCapacity: number;
  avgOccupancy: number;
  avgTurnoverDays: number;
  avgStagnantRatio: number;
  status: "healthy" | "warning" | "critical";
  warehouses: WarehouseRuntime[];
}

export interface OptScenario {
  id: string;
  title: string;
  summary: string;
  active: boolean;
}

const CATEGORIES: WarehouseCategory[] = [
  {
    id: "raw_metal",
    label: "金属原料库群",
    warehouseIds: ["lw-01", "lw-02", "lw-03"],
    description: "涵盖有色金属、五金件及钢材，服务定子/转子铁芯冲剪与线圈绕组"
  },
  {
    id: "chemical",
    label: "化工辅料库",
    warehouseIds: ["lw-04"],
    description: "绝缘漆、环氧树脂、冷却液等电机生产辅助化工材料"
  },
  {
    id: "coil_stock",
    label: "线圈分厂库群",
    warehouseIds: ["cw-01", "cw-02", "cw-03"],
    description: "铜线、漆包线等线圈原料及半成品暂存"
  },
  {
    id: "stamping_stock",
    label: "冲剪分厂库群",
    warehouseIds: ["sw-01", "sw-02", "sw-03"],
    description: "硅钢片、冲压板材及冲剪半成品"
  },
  {
    id: "utility_stock",
    label: "水电分厂库群",
    warehouseIds: ["uw-01", "uw-02", "uw-03"],
    description: "动力备件、水电耗材及应急保障物资"
  }
];

const SCENARIOS: OptScenario[] = [
  {
    id: "baseline",
    title: "现状基线",
    summary: "当前仓储运营状态，未实施任何优化措施。",
    active: true
  },
  {
    id: "abc_classify",
    title: "ABC分类管理",
    summary: "按物料价值与周转频次进行ABC分类，差异化管理库存策略。",
    active: false
  },
  {
    id: "safety_stock",
    title: "安全库存优化",
    summary: "基于水火电发电机生产节拍，动态调整安全库存水位线。",
    active: false
  },
  {
    id: "full_optimize",
    title: "综合优化方案",
    summary: "ABC分类 + 安全库存 + 呆滞清理 + VMI供应商管理库存联动。",
    active: false
  }
];

const SUGGESTIONS: OptSuggestion[] = [
  {
    id: "s1",
    title: "钢材库JIT直送产线",
    description: "钢材集中库占用率偏高，建议与钢材供应商协商JIT送货，减少库内堆积。水电机组定子铁芯冲剪周期长，可按排产计划拉动配送。",
    impact: "预计降低钢材库占用率15%，减少库存资金占用约340万元",
    priority: "high",
    relatedWarehouses: ["lw-03"]
  },
  {
    id: "s2",
    title: "线圈原料合仓整合",
    description: "线圈原料A仓与B仓品类重叠度高，建议合仓管理，统一拣选动线，减少重复备料。",
    impact: "预计提升周转率18%，释放仓储面积约400㎡",
    priority: "high",
    relatedWarehouses: ["cw-01", "cw-02"]
  },
  {
    id: "s3",
    title: "呆滞物料专项清理",
    description: "全公司呆滞物料占比偏高，其中化工辅料库和应急保障仓呆滞风险最大。建议设立90天呆滞预警线，超期物料走调拨或报废流程。",
    impact: "预计清理呆滞库存800吨，释放资金约1600万元",
    priority: "medium",
    relatedWarehouses: ["lw-04", "uw-03"]
  },
  {
    id: "s4",
    title: "冲剪半成品缓冲区优化",
    description: "冲剪半成品仓周转偏慢，与下游金工分厂工序衔接不紧密。建议缩短工序间缓冲量，推行看板拉动式补货。",
    impact: "预计缩短周转天数5天，降低在制品库存约220吨",
    priority: "medium",
    relatedWarehouses: ["sw-03"]
  },
  {
    id: "s5",
    title: "水电备件VMI模式",
    description: "动力备件品种多、消耗不规律，适合引入VMI（供应商管理库存）。由供应商负责补货，企业按消耗结算。",
    impact: "预计降低备件库存30%，减少紧急采购频次60%",
    priority: "low",
    relatedWarehouses: ["uw-01"]
  }
];

export interface AdjustOrder {
  id: string;
  type: "transfer" | "safety" | "dispose" | "merge" | "vmi";
  content: string;
  from: string;
  to: string;
  material: string;
  qty: number;
  unit: string;
  editable: boolean;
}

const SCENARIO_ORDERS: Record<string, AdjustOrder[]> = {
  baseline: [],
  abc_classify: [
    { id: "abc-01", type: "transfer", content: "线圈原料A仓 → 公司一级库：电磁线 120卷（A类高值物料集中管控）", from: "线圈原料A仓", to: "有色金属库", material: "电磁线", qty: 120, unit: "卷", editable: true },
    { id: "abc-02", type: "transfer", content: "冲剪板材一号仓 → 钢材集中库：硅钢片 85吨（A类归集中库统管）", from: "冲剪板材一号仓", to: "钢材集中库", material: "硅钢片", qty: 85, unit: "吨", editable: true },
    { id: "abc-03", type: "safety", content: "线圈原料B仓：漆包线安全库存由 280卷 下调至 200卷（B类降库存水位）", from: "线圈原料B仓", to: "-", material: "漆包线", qty: 200, unit: "卷", editable: true },
    { id: "abc-04", type: "transfer", content: "五金一级库 → 冲剪板材二号仓：冲压模具钢 32吨（就近前置）", from: "五金一级库", to: "冲剪板材二号仓", material: "冲压模具钢", qty: 32, unit: "吨", editable: true },
    { id: "abc-05", type: "safety", content: "化工辅料库：环氧树脂安全库存由 45吨 下调至 30吨（C类减配）", from: "化工辅料库", to: "-", material: "环氧树脂", qty: 30, unit: "吨", editable: true },
    { id: "abc-06", type: "transfer", content: "水电耗材仓 → 动力备件仓：变频器模块 18台（合并同类存储）", from: "水电耗材仓", to: "动力备件仓", material: "变频器模块", qty: 18, unit: "台", editable: true }
  ],
  safety_stock: [
    { id: "ss-01", type: "safety", content: "线圈原料A仓：铜排安全库存由 160吨 下调至 110吨（匹配水电机组排产节拍）", from: "线圈原料A仓", to: "-", material: "铜排", qty: 110, unit: "吨", editable: true },
    { id: "ss-02", type: "safety", content: "线圈成品暂存仓：绕组半成品安全库存由 320件 下调至 240件", from: "线圈成品暂存仓", to: "-", material: "绕组半成品", qty: 240, unit: "件", editable: true },
    { id: "ss-03", type: "transfer", content: "钢材集中库 → 冲剪板材一号仓：冷轧板 60吨（按周排产前置备料）", from: "钢材集中库", to: "冲剪板材一号仓", material: "冷轧板", qty: 60, unit: "吨", editable: true },
    { id: "ss-04", type: "safety", content: "有色金属库：铝母线安全库存由 90吨 下调至 65吨（火电机组订单减少）", from: "有色金属库", to: "-", material: "铝母线", qty: 65, unit: "吨", editable: true },
    { id: "ss-05", type: "safety", content: "动力备件仓：液压阀芯安全库存由 50套 下调至 35套", from: "动力备件仓", to: "-", material: "液压阀芯", qty: 35, unit: "套", editable: true },
    { id: "ss-06", type: "transfer", content: "应急保障仓 → 水电耗材仓：密封件 200件（消除重复备货）", from: "应急保障仓", to: "水电耗材仓", material: "密封件", qty: 200, unit: "件", editable: true },
    { id: "ss-07", type: "safety", content: "冲剪半成品仓：冲压件缓冲量由 180吨 下调至 130吨（看板拉动）", from: "冲剪半成品仓", to: "-", material: "冲压件", qty: 130, unit: "吨", editable: true }
  ],
  full_optimize: [
    { id: "fo-01", type: "merge", content: "线圈原料A仓 + B仓合并：电磁线/漆包线统一至A仓管理，B仓释放用作成品暂存扩容", from: "线圈原料B仓", to: "线圈原料A仓", material: "全部铜线类物料", qty: 1, unit: "批次", editable: true },
    { id: "fo-02", type: "transfer", content: "线圈原料A仓 → 有色金属库：电磁线 150卷（集中管控高值物料）", from: "线圈原料A仓", to: "有色金属库", material: "电磁线", qty: 150, unit: "卷", editable: true },
    { id: "fo-03", type: "transfer", content: "钢材集中库 → 冲剪板材一号仓：硅钢片 95吨（JIT前置7天用量）", from: "钢材集中库", to: "冲剪板材一号仓", material: "硅钢片", qty: 95, unit: "吨", editable: true },
    { id: "fo-04", type: "dispose", content: "化工辅料库：过期绝缘漆 12吨 → 报废处置（超90天呆滞）", from: "化工辅料库", to: "报废", material: "过期绝缘漆", qty: 12, unit: "吨", editable: true },
    { id: "fo-05", type: "dispose", content: "应急保障仓：老型号密封件 350件 → 调拨至兄弟单位（超180天呆滞）", from: "应急保障仓", to: "外部调拨", material: "老型号密封件", qty: 350, unit: "件", editable: true },
    { id: "fo-06", type: "safety", content: "有色金属库：铜排安全库存由 160吨 下调至 100吨", from: "有色金属库", to: "-", material: "铜排", qty: 100, unit: "吨", editable: true },
    { id: "fo-07", type: "safety", content: "冲剪半成品仓：冲压件缓冲量由 180吨 下调至 120吨（看板拉动）", from: "冲剪半成品仓", to: "-", material: "冲压件", qty: 120, unit: "吨", editable: true },
    { id: "fo-08", type: "vmi", content: "动力备件仓：启用VMI模式 → 液压阀芯/变频器模块由供应商管理补货", from: "动力备件仓", to: "VMI供应商", material: "液压阀芯等", qty: 1, unit: "批次", editable: true },
    { id: "fo-09", type: "transfer", content: "五金一级库 → 冲剪板材二号仓：冲压模具钢 45吨（产线就近前置）", from: "五金一级库", to: "冲剪板材二号仓", material: "冲压模具钢", qty: 45, unit: "吨", editable: true },
    { id: "fo-10", type: "safety", content: "水电耗材仓：工业润滑剂安全库存由 25吨 下调至 18吨", from: "水电耗材仓", to: "-", material: "工业润滑剂", qty: 18, unit: "吨", editable: true }
  ]
};

export function useWarehouseOptModel(allWarehouses: WarehouseRuntime[]) {
  const warehouseMap = new Map(allWarehouses.map((w) => [w.id, w]));
  const activeScenarioId = ref("baseline");

  const categoryAnalyses = computed<CategoryAnalysis[]>(() =>
    CATEGORIES.map((cat) => {
      const warehouses = cat.warehouseIds
        .map((id) => warehouseMap.get(id))
        .filter((w): w is WarehouseRuntime => !!w);
      const totalInventory = warehouses.reduce((s, w) => s + w.currentInventory, 0);
      const totalCapacity = warehouses.reduce((s, w) => s + w.capacity, 0);
      const avgOccupancy = warehouses.length
        ? warehouses.reduce((s, w) => s + w.occupancyRate, 0) / warehouses.length
        : 0;
      const avgTurnoverDays = warehouses.length
        ? warehouses.reduce((s, w) => s + w.turnoverDays, 0) / warehouses.length
        : 0;
      const avgStagnantRatio = warehouses.length
        ? warehouses.reduce((s, w) => s + w.stagnantRatio, 0) / warehouses.length
        : 0;

      let status: CategoryAnalysis["status"] = "healthy";
      if (avgOccupancy > 85 || avgStagnantRatio > 25) status = "critical";
      else if (avgOccupancy > 70 || avgStagnantRatio > 15 || avgTurnoverDays > 30) status = "warning";

      return {
        category: cat,
        totalInventory,
        totalCapacity,
        avgOccupancy: Math.round(avgOccupancy * 10) / 10,
        avgTurnoverDays: Math.round(avgTurnoverDays * 10) / 10,
        avgStagnantRatio: Math.round(avgStagnantRatio * 10) / 10,
        status,
        warehouses
      };
    })
  );

  const companyOverview = computed(() => {
    const total = allWarehouses.reduce((s, w) => s + w.currentInventory, 0);
    const capacity = allWarehouses.reduce((s, w) => s + w.capacity, 0);
    const amount = allWarehouses.reduce((s, w) => s + w.currentAmount, 0);
    const avgOccupancy = allWarehouses.length
      ? allWarehouses.reduce((s, w) => s + w.occupancyRate, 0) / allWarehouses.length
      : 0;
    const avgTurnoverDays = allWarehouses.length
      ? allWarehouses.reduce((s, w) => s + w.turnoverDays, 0) / allWarehouses.length
      : 0;
    const avgStagnantRatio = allWarehouses.length
      ? allWarehouses.reduce((s, w) => s + w.stagnantRatio, 0) / allWarehouses.length
      : 0;
    return {
      totalInventory: Math.round(total),
      totalCapacity: Math.round(capacity),
      totalAmount: Math.round(amount * 100) / 100,
      avgOccupancy: Math.round(avgOccupancy * 10) / 10,
      avgTurnoverDays: Math.round(avgTurnoverDays * 10) / 10,
      avgStagnantRatio: Math.round(avgStagnantRatio * 10) / 10,
      warehouseCount: allWarehouses.length
    };
  });

  const optimizeMultiplier: Record<string, number> = {
    baseline: 1,
    abc_classify: 0.82,
    safety_stock: 0.75,
    full_optimize: 0.58
  };

  const kpiComparison = computed<OptKpi[]>(() => {
    const m = optimizeMultiplier[activeScenarioId.value] ?? 1;
    const ov = companyOverview.value;
    return [
      {
        label: "平均周转天数",
        before: ov.avgTurnoverDays,
        after: Math.round(ov.avgTurnoverDays * m * 10) / 10,
        unit: "天",
        direction: "lower"
      },
      {
        label: "平均占用率",
        before: ov.avgOccupancy,
        after: Math.round(ov.avgOccupancy * (1 - (1 - m) * 0.6) * 10) / 10,
        unit: "%",
        direction: "lower"
      },
      {
        label: "呆滞占比",
        before: ov.avgStagnantRatio,
        after: Math.round(ov.avgStagnantRatio * m * 0.9 * 10) / 10,
        unit: "%",
        direction: "lower"
      },
      {
        label: "库存资金占用",
        before: ov.totalAmount,
        after: Math.round(ov.totalAmount * (1 - (1 - m) * 0.45) * 100) / 100,
        unit: "万元",
        direction: "lower"
      }
    ];
  });

  const adjustOrders = ref<AdjustOrder[]>([]);

  function setScenario(id: string) {
    activeScenarioId.value = id;
    const templateOrders = SCENARIO_ORDERS[id] ?? [];
    adjustOrders.value = templateOrders.map((o) => ({ ...o }));
  }

  function updateOrderQty(orderId: string, newQty: number) {
    const order = adjustOrders.value.find((o) => o.id === orderId);
    if (order && order.editable) {
      order.qty = newQty;
      order.content = order.content.replace(/\d+(\s*(卷|吨|件|套|台|批次))/, `${newQty}$1`);
    }
  }

  function removeOrder(orderId: string) {
    adjustOrders.value = adjustOrders.value.filter((o) => o.id !== orderId);
  }

  return {
    categories: CATEGORIES,
    scenarios: SCENARIOS,
    suggestions: SUGGESTIONS,
    activeScenarioId,
    categoryAnalyses,
    companyOverview,
    kpiComparison,
    adjustOrders,
    setScenario,
    updateOrderQty,
    removeOrder
  };
}
