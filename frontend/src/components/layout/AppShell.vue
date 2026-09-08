<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { ChevronRight } from "@lucide/vue";
import AppSidebar from "@/components/layout/AppSidebar.vue";
import AppSidebarRight from "@/components/layout/AppSidebarRight.vue";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

const route = useRoute();
const pageTitle = computed(() => ({
  input: "Input harian",
  riwayat: "Riwayat",
  "admin-users": "Kelola user",
  "admin-projects": "Kelola project",
}[String(route.name)] ?? "Ruang kerja"));
const isAdminRoute = computed(() => String(route.name).startsWith("admin-"));
</script>

<template>
  <SidebarProvider>
    <a href="#main-content" class="sr-only z-50 rounded-lg bg-background p-3 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
      Lewati ke konten
    </a>
    <AppSidebar />
    <SidebarInset class="h-svh min-w-0 overflow-hidden">
      <header class="flex h-16 shrink-0 items-center gap-2 border-b px-3">
        <SidebarTrigger class="size-11 shrink-0 md:size-8" aria-label="Buka/tutup sidebar" />
        <Separator orientation="vertical" class="mr-2 data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center" />
        <nav aria-label="Breadcrumb" class="min-w-0 text-sm">
          <ol class="flex min-w-0 items-center gap-2">
            <li class="hidden text-muted-foreground md:block">{{ isAdminRoute ? 'Administrasi' : 'Laporan' }}</li>
            <li class="hidden md:block"><ChevronRight class="size-3.5 text-muted-foreground" aria-hidden="true" /></li>
            <li aria-current="page" class="truncate">{{ pageTitle }}</li>
          </ol>
        </nav>
      </header>

      <ScrollArea id="main-content" tabindex="-1" class="min-h-0 min-w-0 flex-1 outline-none">
        <div class="flex min-w-0 flex-col gap-4 p-5">
          <slot />
        </div>
      </ScrollArea>
    </SidebarInset>
    <AppSidebarRight />
  </SidebarProvider>
</template>
