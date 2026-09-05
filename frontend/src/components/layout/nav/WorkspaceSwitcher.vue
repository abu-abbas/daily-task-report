<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ChevronDown, ClipboardList, ShieldCheck } from "@lucide/vue";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { useMe } from "@/composables/useAuth";

const route = useRoute();
const router = useRouter();
const me = useMe();

const isAdminSpace = computed(() => String(route.name).startsWith("admin-"));
const canSeeAdmin = computed(() => me.data.value?.user.roles.includes("admin") ?? false);

const active = computed(() =>
  isAdminSpace.value
    ? { label: "Administrasi", icon: ShieldCheck }
    : { label: "Ruang kerja saya", icon: ClipboardList },
);
</script>

<template>
  <SidebarMenu>
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <SidebarMenuButton class="w-fit px-1.5">
            <div class="flex aspect-square size-7.5 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <component :is="active.icon" class="size-3" />
            </div>
            <span class="truncate font-medium">{{ active.label }}</span>
            <ChevronDown class="opacity-50" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent class="w-64 rounded-lg" align="start" side="bottom" :side-offset="4">
          <DropdownMenuLabel class="text-xs text-muted-foreground">Ruang kerja</DropdownMenuLabel>
          <DropdownMenuItem class="gap-2 p-2" @click="router.push('/input')">
            <div class="flex size-6 items-center justify-center rounded-xs border">
              <ClipboardList class="size-4 shrink-0" />
            </div>
            Ruang kerja saya
          </DropdownMenuItem>
          <DropdownMenuItem v-if="canSeeAdmin" class="gap-2 p-2" @click="router.push('/admin/users')">
            <div class="flex size-6 items-center justify-center rounded-xs border">
              <ShieldCheck class="size-4 shrink-0" />
            </div>
            Administrasi
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  </SidebarMenu>
</template>
