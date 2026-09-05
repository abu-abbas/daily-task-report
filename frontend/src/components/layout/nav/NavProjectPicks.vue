<script setup lang="ts">
import { toast } from "vue-sonner";
import { Copy, MoreHorizontal, Power, Star } from "@lucide/vue";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

// Data contoh sementara — diganti data project sungguhan saat halaman Kelola project (Stage 2) siap.
interface PinnedProject {
  nama: string;
  aktif: boolean;
}

const props = defineProps<{ projects: PinnedProject[] }>();
const { isMobile } = useSidebar();

function salinNama(nama: string) {
  navigator.clipboard?.writeText(nama).catch(() => {});
  toast.success(`Nama project "${nama}" disalin.`);
}

function toggleAktif(project: PinnedProject) {
  project.aktif = !project.aktif;
  toast.success(`Project "${project.nama}" ${project.aktif ? "diaktifkan" : "dinonaktifkan"}.`);
}
</script>

<template>
  <SidebarGroup class="group-data-[collapsible=icon]:hidden">
    <SidebarGroupLabel>Project pilihan</SidebarGroupLabel>
    <SidebarMenu>
      <SidebarMenuItem v-for="project in props.projects" :key="project.nama">
        <SidebarMenuButton :class="{ 'text-muted-foreground': !project.aktif }">
          <Star class="fill-current text-amber-500" />
          <span>{{ project.nama }}</span>
        </SidebarMenuButton>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <SidebarMenuAction show-on-hover>
              <MoreHorizontal />
              <span class="sr-only">Aksi lain</span>
            </SidebarMenuAction>
          </DropdownMenuTrigger>
          <DropdownMenuContent class="w-56 rounded-lg" :side="isMobile ? 'bottom' : 'right'" :align="isMobile ? 'end' : 'start'">
            <DropdownMenuItem @click="salinNama(project.nama)">
              <Copy class="text-muted-foreground" />
              <span>Salin nama project</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem @click="toggleAktif(project)">
              <Power class="text-muted-foreground" />
              <span>{{ project.aktif ? "Nonaktifkan" : "Aktifkan" }} project</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  </SidebarGroup>
</template>
