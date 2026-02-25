<template>
  <section class="terminal">
    <header class="terminal__header">
      <div class="terminal__dots">
        <span /><span /><span />
      </div>
      <span class="terminal__title">仓储配置调整方案 — {{ scenarioTitle }}</span>
      <div class="terminal__actions">
        <button v-if="orders.length" class="btn-dispatch" @click="handleDispatch">
          下发执行
        </button>
      </div>
    </header>

    <div ref="scrollArea" class="terminal__body">
      <template v-if="!orders.length">
        <div class="terminal__empty">
          <span class="prompt">$</span>
          <span class="muted">请在右侧面板选择优化方案，系统将自动生成调整指令…</span>
        </div>
      </template>
      <template v-else>
        <div class="terminal__line system">
          <span class="prompt">$</span>
          <span>系统已生成 <b>{{ orders.length }}</b> 条调整指令（{{ scenarioTitle }}），可人工修改数量后下发执行。</span>
        </div>
        <div
          v-for="(order, idx) in orders"
          :key="order.id"
          :class="['terminal__line', 'order', typeClass(order.type)]"
        >
          <span class="line-num">{{ String(idx + 1).padStart(2, '0') }}</span>
          <span :class="['type-tag', order.type]">{{ typeLabel(order.type) }}</span>
          <span class="order-text">
            {{ order.from }}
            <template v-if="order.to !== '-'"> → {{ order.to }}</template>
            ：{{ order.material }}
          </span>
          <span class="order-qty">
            <input
              v-if="order.editable"
              type="number"
              :value="order.qty"
              class="qty-input"
              min="0"
              @change="onQtyChange(order.id, $event)"
            />
            <span v-else>{{ order.qty }}</span>
            <span class="unit">{{ order.unit }}</span>
          </span>
          <button class="btn-remove" title="移除" @click="$emit('removeOrder', order.id)">×</button>
        </div>
        <div v-if="!dispatched" class="terminal__line system">
          <span class="prompt">$</span>
          <span class="muted">— 指令末尾 — 可修改数量或移除条目后点击「下发执行」</span>
        </div>

        <template v-if="feedbackLines.length">
          <div class="terminal__line system dispatch-header">
            <span class="prompt" style="color:#60a5fa">▶</span>
            <span style="color:#60a5fa;font-weight:700">指令下发中…</span>
          </div>
          <div
            v-for="(line, i) in feedbackLines"
            :key="'fb-' + i"
            :class="['terminal__line', 'feedback', line.status]"
          >
            <span class="fb-time">{{ line.time }}</span>
            <span :class="['fb-status', line.status]">{{ statusLabel(line.status) }}</span>
            <span class="fb-text">{{ line.text }}</span>
          </div>
        </template>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount } from "vue";
import type { AdjustOrder } from "@/composables/useWarehouseOptModel";

interface Props {
  orders: AdjustOrder[];
  scenarioTitle: string;
}

interface FeedbackLine {
  time: string;
  status: "running" | "done" | "info";
  text: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  updateQty: [orderId: string, qty: number];
  removeOrder: [orderId: string];
  dispatch: [];
}>();

const scrollArea = ref<HTMLElement | null>(null);
const feedbackLines = ref<FeedbackLine[]>([]);
const dispatched = ref(false);
let feedbackTimers: ReturnType<typeof setTimeout>[] = [];

watch(
  () => props.orders.length,
  async () => {
    await nextTick();
    scrollToBottom();
  }
);

watch(
  () => props.scenarioTitle,
  () => {
    dispatched.value = false;
    feedbackLines.value = [];
    clearTimers();
  }
);

onBeforeUnmount(() => clearTimers());

function clearTimers() {
  feedbackTimers.forEach(clearTimeout);
  feedbackTimers = [];
}

function scrollToBottom() {
  if (scrollArea.value) scrollArea.value.scrollTop = scrollArea.value.scrollHeight;
}

function onQtyChange(orderId: string, event: Event) {
  const input = event.target as HTMLInputElement;
  const val = parseInt(input.value, 10);
  if (!isNaN(val) && val >= 0) emit("updateQty", orderId, val);
}

function now(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function buildFeedback(orders: AdjustOrder[]): FeedbackLine[] {
  const lines: FeedbackLine[] = [];
  lines.push({ time: now(), status: "info", text: `系统接收 ${orders.length} 条指令，开始逐条执行…` });

  const workshops = new Set<string>();
  for (const o of orders) {
    workshops.add(o.from);
    if (o.to !== "-" && o.to !== "报废" && o.to !== "外部调拨" && o.to !== "VMI供应商") {
      workshops.add(o.to);
    }
  }
  for (const ws of workshops) {
    lines.push({ time: now(), status: "running", text: `${ws} 正在调配物料，仓管员已收到通知…` });
  }

  for (const o of orders) {
    if (o.type === "transfer") {
      lines.push({ time: now(), status: "done", text: `${o.material} ${o.qty}${o.unit} 已从 ${o.from} 发出 → ${o.to} 接收中` });
    } else if (o.type === "safety") {
      lines.push({ time: now(), status: "done", text: `${o.from} ${o.material} 安全库存已调整至 ${o.qty}${o.unit}` });
    } else if (o.type === "dispose") {
      lines.push({ time: now(), status: "done", text: `${o.from} ${o.material} ${o.qty}${o.unit} 已标记处置，等待审批` });
    } else if (o.type === "merge") {
      lines.push({ time: now(), status: "done", text: `${o.from} → ${o.to} 合仓指令已下发，仓储系统同步更新` });
    } else if (o.type === "vmi") {
      lines.push({ time: now(), status: "done", text: `${o.from} 已切换 VMI 模式，供应商补货通道已开通` });
    }
  }

  lines.push({ time: now(), status: "info", text: `全部 ${orders.length} 条指令执行完毕，仓储配置已更新。` });
  return lines;
}

function handleDispatch() {
  if (!confirm(`确认下发 ${props.orders.length} 条调整指令？`)) return;
  dispatched.value = true;
  feedbackLines.value = [];
  clearTimers();
  emit("dispatch");

  const allLines = buildFeedback(props.orders);
  allLines.forEach((line, i) => {
    const timer = setTimeout(async () => {
      feedbackLines.value.push(line);
      await nextTick();
      scrollToBottom();
    }, (i + 1) * 600);
    feedbackTimers.push(timer);
  });
}

function typeLabel(type: AdjustOrder["type"]): string {
  const map: Record<string, string> = {
    transfer: "调拨",
    safety: "调参",
    dispose: "处置",
    merge: "合仓",
    vmi: "VMI"
  };
  return map[type] ?? type;
}

function typeClass(type: AdjustOrder["type"]): string {
  return `type-${type}`;
}

function statusLabel(status: FeedbackLine["status"]): string {
  if (status === "running") return "执行中";
  if (status === "done") return "完成";
  return "系统";
}
</script>

<style scoped>
.terminal {
  display: flex;
  flex-direction: column;
  background: #1e293b;
  border-radius: 8px;
  overflow: hidden;
  font-family: "JetBrains Mono", "Consolas", "Courier New", monospace;
  border: 1px solid #334155;
}

.terminal__header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  background: #0f172a;
  border-bottom: 1px solid #334155;
  flex-shrink: 0;
}

.terminal__dots {
  display: flex;
  gap: 5px;
}

.terminal__dots span {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.terminal__dots span:nth-child(1) { background: #ef4444; }
.terminal__dots span:nth-child(2) { background: #f59e0b; }
.terminal__dots span:nth-child(3) { background: #22c55e; }

.terminal__title {
  flex: 1;
  font-size: 11px;
  color: #94a3b8;
}

.terminal__actions {
  display: flex;
  gap: 6px;
}

.btn-dispatch {
  padding: 4px 14px;
  font-size: 11px;
  font-weight: 600;
  color: #ffffff;
  background: #16a34a;
  border: 1px solid #15803d;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-dispatch:hover {
  background: #15803d;
}

.terminal__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 12px;
  font-size: 12px;
  line-height: 1.7;
  color: #e2e8f0;
}

.terminal__empty {
  display: flex;
  gap: 8px;
  align-items: center;
}

.prompt {
  color: #22c55e;
  font-weight: 700;
  margin-right: 4px;
}

.muted {
  color: #64748b;
}

.terminal__line {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
  border-bottom: 1px solid rgba(51, 65, 85, 0.4);
}

.terminal__line.system {
  border-bottom: none;
}

.line-num {
  color: #475569;
  font-size: 10px;
  min-width: 18px;
}

.type-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: 600;
  min-width: 32px;
  text-align: center;
}

.type-tag.transfer {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
}

.type-tag.safety {
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
}

.type-tag.dispose {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}

.type-tag.merge {
  background: rgba(168, 85, 247, 0.2);
  color: #c084fc;
}

.type-tag.vmi {
  background: rgba(6, 182, 212, 0.2);
  color: #22d3ee;
}

.order-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #cbd5e1;
}

.order-qty {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.qty-input {
  width: 56px;
  padding: 2px 4px;
  font-size: 12px;
  font-family: inherit;
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.08);
  border: 1px solid #475569;
  border-radius: 3px;
  text-align: right;
  outline: none;
  transition: border-color 0.2s;
}

.qty-input:focus {
  border-color: #fbbf24;
}

.unit {
  color: #64748b;
  font-size: 11px;
}

.btn-remove {
  padding: 0 4px;
  font-size: 14px;
  color: #64748b;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: color 0.2s;
  line-height: 1;
}

.btn-remove:hover {
  color: #ef4444;
}

.terminal__body::-webkit-scrollbar {
  width: 5px;
}

.terminal__body::-webkit-scrollbar-track {
  background: transparent;
}

.terminal__body::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 3px;
}

/* 反馈日志 */
.dispatch-header {
  margin-top: 6px;
  border-top: 1px solid #334155;
  padding-top: 6px;
}

.feedback {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.fb-time {
  color: #475569;
  font-size: 10px;
  min-width: 56px;
}

.fb-status {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: 600;
  min-width: 40px;
  text-align: center;
}

.fb-status.running {
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
}

.fb-status.done {
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
}

.fb-status.info {
  background: rgba(96, 165, 250, 0.15);
  color: #60a5fa;
}

.fb-text {
  color: #94a3b8;
  flex: 1;
}

.feedback.done .fb-text {
  color: #a7f3d0;
}

.feedback.info .fb-text {
  color: #93c5fd;
}
</style>
