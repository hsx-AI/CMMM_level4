<template>
  <div ref="canvasHost" class="three-canvas-host"></div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useThreeScene } from "@/composables/useThreeScene";
import type { WorkshopInfo } from "@/types/workshop";
import type { TurnoverClass, WarehouseRuntime } from "@/types/warehouse";

interface Props {
  workshops: WorkshopInfo[];
  warehouses: WarehouseRuntime[];
  initialWorkshopId: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  workshopSelected: [workshop: WorkshopInfo];
  warehouseSelected: [warehouse: WarehouseRuntime];
}>();

const canvasHost = ref<HTMLElement | null>(null);
let sceneApi: ReturnType<typeof useThreeScene> | null = null;

function focusWorkshop(workshopId: string) {
  sceneApi?.focusWorkshop(workshopId);
}

function focusWarehouse(warehouseId: string) {
  sceneApi?.focusWarehouse(warehouseId);
}

function applyTurnoverFilter(classKey: TurnoverClass | null) {
  sceneApi?.applyTurnoverFilter(classKey);
}

defineExpose({
  focusWorkshop,
  focusWarehouse,
  applyTurnoverFilter
});

onMounted(() => {
  if (!canvasHost.value) return;
  sceneApi = useThreeScene({
    container: canvasHost.value,
    workshops: props.workshops,
    warehouses: props.warehouses,
    onWorkshopSelect: (workshop) => emit("workshopSelected", workshop),
    onWarehouseSelect: (warehouse) => emit("warehouseSelected", warehouse)
  });
  sceneApi.focusWorkshop(props.initialWorkshopId);
});

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
