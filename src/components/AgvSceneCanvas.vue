<template>
  <div ref="canvasHost" class="three-canvas-host"></div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import networkConfig from "@/mock/agv/network.json";
import { useAgvScene } from "@/composables/useAgvScene";
import type { AgvCaseRunResult, AgvEdge, AgvNode } from "@/types/agv";

interface Props {
  caseResult: AgvCaseRunResult;
  playing: boolean;
}

const props = defineProps<Props>();
const canvasHost = ref<HTMLElement | null>(null);
const nodes = networkConfig.nodes as AgvNode[];
const edges = networkConfig.edges as AgvEdge[];

let sceneApi: ReturnType<typeof useAgvScene> | null = null;

function resetAnimation() {
  sceneApi?.reset();
  if (props.playing) sceneApi?.play();
}

defineExpose({
  resetAnimation
});

onMounted(() => {
  if (!canvasHost.value) return;
  sceneApi = useAgvScene({
    container: canvasHost.value,
    nodes,
    edges
  });
  sceneApi.setCaseResult(props.caseResult);
  if (props.playing) sceneApi.play();
  else sceneApi.pause();
});

watch(
  () => props.caseResult,
  (value) => {
    sceneApi?.setCaseResult(value);
    if (props.playing) sceneApi?.play();
    else sceneApi?.pause();
  },
  { deep: true }
);

watch(
  () => props.playing,
  (value) => {
    if (value) sceneApi?.play();
    else sceneApi?.pause();
  }
);

onBeforeUnmount(() => {
  sceneApi?.destroy();
  sceneApi = null;
});
</script>

<style scoped>
.three-canvas-host {
  width: 100%;
  height: 100%;
  min-height: 480px;
}
</style>
