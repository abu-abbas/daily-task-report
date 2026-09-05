<script setup lang="ts">
import { useRouter } from "vue-router";
import { ChevronsUpDown, LogOut } from "@lucide/vue";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { useLogout, useMe } from "@/composables/useAuth";

const me = useMe();
const logout = useLogout();
const router = useRouter();
const { isMobile } = useSidebar();

async function handleLogout() {
  await logout.mutateAsync();
  router.push("/login");
}
</script>

<template>
  <SidebarMenu v-if="me.data.value?.user">
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <SidebarMenuButton size="lg" class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
            <Avatar class="size-8 rounded-lg">
              <AvatarFallback class="rounded-lg">{{ me.data.value.user.nama.slice(0, 1).toUpperCase() }}</AvatarFallback>
            </Avatar>
            <div class="grid flex-1 text-left text-sm leading-tight">
              <span class="truncate font-medium">{{ me.data.value.user.nama }}</span>
              <span class="truncate text-xs">{{ me.data.value.user.email }}</span>
            </div>
            <ChevronsUpDown class="ml-auto size-4" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent class="w-56 rounded-lg" :side="isMobile ? 'bottom' : 'right'" align="start" :side-offset="4">
          <DropdownMenuLabel class="p-0 font-normal">
            <div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
              <Avatar class="size-8 rounded-lg">
                <AvatarFallback class="rounded-lg">{{ me.data.value.user.nama.slice(0, 1).toUpperCase() }}</AvatarFallback>
              </Avatar>
              <div class="grid flex-1 text-left text-sm leading-tight">
                <span class="truncate font-medium">{{ me.data.value.user.nama }}</span>
                <span class="truncate text-xs">{{ me.data.value.user.email }}</span>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem :disabled="logout.isPending.value" @click="handleLogout">
            <LogOut />
            Keluar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  </SidebarMenu>
</template>
