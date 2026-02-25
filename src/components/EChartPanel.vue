<template>
  <div ref="chartRef" class="chart" :style="{ height }"></div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as echarts from "echarts/core";
import { LineChart, BarChart } from "echarts/charts";
import {
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DatasetComponent
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";

echarts.use([
  LineChart,
  BarChart,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DatasetComponent,
  CanvasRenderer
]);

interface Props {
  option: EChartsOption;
  height?: string;
}

const props = withDefaults(defineProps<Props>(), {
  height: "220px"
});

const emit = defineEmits<{
  chartClick: [payload: { name?: string; seriesName?: string; value?: unknown }];
}>();

const chartRef = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;

function render() {
  if (!chartRef.value) return;
  if (!chart) {
    chart = echarts.init(chartRef.value);
    chart.on("click", (params) => {
      emit("chartClick", {
        name: typeof params.name === "string" ? params.name : undefined,
        seriesName: params.seriesName,
        value: params.value
      });
    });
  }
  chart.setOption(props.option, true);
}

function resize() {
  chart?.resize();
}

watch(
  () => props.option,
  () => {
    render();
  },
  { deep: true }
);

onMounted(() => {
  render();
  window.addEventListener("resize", resize);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", resize);
  chart?.dispose();
  chart = null;
});
</script>

<style scoped>
.chart {
  width: 100%;
}
</style>
