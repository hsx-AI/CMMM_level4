<template>
  <aside class="nav-panel">
    <div class="nav-panel__title">功能导航</div>
    <ul>
      <li
        v-for="item in items"
        :key="item.key"
        :class="{ active: item.key === activeKey }"
        @click="$emit('change', item.key)"
      >
        {{ item.label }}
      </li>
    </ul>
  </aside>
</template>

<script setup lang="ts">
import type { NavItem } from "@/types/workshop";

interface Props {
  items: NavItem[];
  activeKey: string;
}

defineProps<Props>();

defineEmits<{
  change: [key: string];
}>();
</script>

<style scoped>
.nav-panel {
  height: 100%;
  background: var(--panel-bg);
  border: var(--panel-border);
  border-radius: var(--panel-radius);
  box-shadow: var(--shadow-sm);
  padding: 16px 12px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 14px;
  animation: fadeSlideUp 0.4s ease-out 0.05s both;
}

.nav-panel__title {
  color: var(--c-primary);
  letter-spacing: 1px;
  font-size: 14px;
  font-weight: 600;
  padding-left: 10px;
  border-left: 3px solid var(--c-primary);
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

li {
  cursor: pointer;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 14px;
  color: var(--text-secondary);
  background: var(--bg-inset);
  border: 1px solid transparent;
  transition: all 0.2s ease;
}

li:hover {
  color: var(--text-primary);
  background: var(--c-primary-light);
  border-color: var(--border-default);
}

li.active {
  color: var(--c-primary);
  background: var(--c-primary-light);
  border-color: var(--border-active);
  border-left: 3px solid var(--c-primary);
  font-weight: 600;
}
</style>
