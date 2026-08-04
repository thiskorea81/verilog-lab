import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: () => import("../views/HomeView.vue") },
    { path: "/theory/intro", name: "theory-intro", component: () => import("../views/theory/IntroView.vue") },
    { path: "/theory/combinational", name: "theory-comb", component: () => import("../views/theory/CombinationalView.vue") },
    { path: "/theory/sequential", name: "theory-seq", component: () => import("../views/theory/SequentialView.vue") },
    { path: "/lab", name: "lab", component: () => import("../views/LabView.vue") },
  ],
});

export default router;
