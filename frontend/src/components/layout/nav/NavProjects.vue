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
import type { Project } from "@/lib/api";

defineProps<{ projects: Project[] }>();
</script>

<template>
  <SidebarGroup>
    <SidebarGroupLabel>Project</SidebarGroupLabel>
    <SidebarGroupContent>
      <SidebarMenu>
        <Collapsible v-for="project in projects" :key="project.id">
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
                <SidebarMenuSubItem v-for="member in project.members" :key="member.id">
                  <SidebarMenuSubButton as-child>
                    <span>{{ member.nama }}</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem v-if="project.members.length === 0">
                  <span class="px-2 text-xs text-muted-foreground">Belum ada anggota</span>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
</template>
