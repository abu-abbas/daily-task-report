<script setup lang="ts">
import { ref } from "vue";
import { useRoute } from "vue-router";
import { ClipboardList, History, ShieldCheck, X } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { useMe } from "@/composables/useAuth";
import WorkspaceSwitcher from "@/components/layout/nav/WorkspaceSwitcher.vue";
import NavProjectPicks from "@/components/layout/nav/NavProjectPicks.vue";
import NavProjects from "@/components/layout/nav/NavProjects.vue";
import SidebarUserMenu from "@/components/layout/nav/SidebarUserMenu.vue";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

// Data contoh sementara — diganti data project sungguhan saat halaman Kelola project (Stage 2) siap.
const projects = ref([
  { nama: "Sistem Laporan Harian", anggota: ["Agus Prasetyo", "Maya Puspita"], aktif: true },
  { nama: "Migrasi Data Legacy", anggota: ["Budi Santoso"], aktif: true },
  { nama: "Portal Internal", anggota: ["Maya Puspita"], aktif: false },
]);
const pinnedProjects = ref(
  projects.value.map((p) => ({ nama: p.nama, aktif: p.aktif })).slice(0, 2),
);

const route = useRoute();
const me = useMe();
const { isMobile, setOpenMobile } = useSidebar();
</script>

<template>
  <Sidebar class="border-r-0">
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem class="flex items-center">
          <div class="flex-1">
            <WorkspaceSwitcher />
          </div>
          <Button v-if="isMobile" variant="ghost" size="icon" class="size-11 shrink-0" aria-label="Tutup sidebar" @click="setOpenMobile(false)">
            <X class="size-4" aria-hidden="true" />
          </Button>
        </SidebarMenuItem>
      </SidebarMenu>

      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton as-child :is-active="route.name === 'input'" class="h-11 md:h-8" @click="setOpenMobile(false)">
            <RouterLink to="/input">
              <ClipboardList />
              <span>Input harian</span>
            </RouterLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton as-child :is-active="route.name === 'riwayat'" class="h-11 md:h-8" @click="setOpenMobile(false)">
            <RouterLink to="/riwayat">
              <History />
              <span>Riwayat</span>
            </RouterLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>

    <SidebarContent>
      <NavProjectPicks :projects="pinnedProjects" />
      <NavProjects :projects="projects" />

      <SidebarGroup v-if="me.data.value?.user.roles.includes('admin')">
        <SidebarGroupLabel>Administrasi</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton as-child :is-active="route.name === 'admin-users'" class="h-11 md:h-8" @click="setOpenMobile(false)">
              <RouterLink to="/admin/users">
                <ShieldCheck />
                <span>Kelola user</span>
              </RouterLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
    </SidebarContent>
    <SidebarFooter>
      <SidebarUserMenu />
    </SidebarFooter>
    <SidebarRail aria-label="Buka/tutup sidebar" title="Buka/tutup sidebar" />
  </Sidebar>
</template>
