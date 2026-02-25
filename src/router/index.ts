import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import ScreenLayout from "@/layout/ScreenLayout.vue";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "home",
    component: ScreenLayout
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
