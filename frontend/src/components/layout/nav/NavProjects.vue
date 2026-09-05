<script setup lang="ts">
import { ChevronRight, FolderKanban } from "@lucide/vue";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

// Data contoh sementara — diganti data project sungguhan saat halaman Kelola project (Stage 2) siap.
interface ProjectPreview {
  nama: string;
  anggota: string[];
}

defineProps<{ projects: ProjectPreview[] }>();
</script>

<template>
  <SidebarGroup>
    <SidebarGroupLabel>Project</SidebarGroupLabel>
    <SidebarGroupContent>
      <SidebarMenu>
        <Collapsible v-for="project in projects" :key="project.nama">
          <SidebarMenuItem>
            <SidebarMenuButton>
              <FolderKanban />
              <span>{{ project.nama }}</span>
            </SidebarMenuButton>
            <CollapsibleTrigger as-child>
              <SidebarMenuAction class="left-2 bg-sidebar-accent text-sidebar-accent-foreground data-[state=open]:rotate-90" show-on-hover>
                <ChevronRight />
              </SidebarMenuAction>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                <SidebarMenuSubItem v-for="nama in project.anggota" :key="nama">
                  <SidebarMenuSubButton as-child>
                    <span>{{ nama }}</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
</template>
