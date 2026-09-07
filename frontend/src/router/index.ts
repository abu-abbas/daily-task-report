import { createRouter, createWebHistory } from "vue-router";
import { queryClient } from "@/lib/queryClient";
import { fetchMe } from "@/lib/api";
import { ME_QUERY_KEY } from "@/composables/useAuth";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/login",
      name: "login",
      component: () => import("@/views/LoginView.vue"),
      meta: { public: true },
    },
    {
      path: "/",
      name: "beranda",
      component: () => import("@/views/BerandaView.vue"),
    },
    {
      path: "/input",
      name: "input",
      component: () => import("@/views/InputHarianView.vue"),
    },
    {
      path: "/riwayat",
      name: "riwayat",
      component: () => import("@/views/RiwayatView.vue"),
    },
    {
      path: "/admin/users",
      name: "admin-users",
      component: () => import("@/views/admin/AdminUsersView.vue"),
    },
    {
      path: "/admin/projects",
      name: "admin-projects",
      component: () => import("@/views/admin/AdminProjectsView.vue"),
    },
  ],
});

router.beforeEach(async (to) => {
  if (to.meta.public) return true;

  try {
    await queryClient.ensureQueryData({ queryKey: ME_QUERY_KEY, queryFn: fetchMe });
    return true;
  } catch {
    return { name: "login", query: { redirect: to.fullPath } };
  }
});

export default router;
