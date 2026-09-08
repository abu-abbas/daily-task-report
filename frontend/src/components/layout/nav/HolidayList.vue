<script setup lang="ts">
import { computed } from "vue";
import { ChevronRight, Trash2 } from "@lucide/vue";
import { LOCALE } from "@/lib/locale";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";

export interface Holiday {
  id: number;
  nama: string;
  tanggalMulai: string;
  tanggalAkhir: string;
}

const props = defineProps<{ holidays: Holiday[]; canManage?: boolean }>();
const emit = defineEmits<{ delete: [id: number] }>();

const hariIni = new Date().toISOString().slice(0, 10);

function formatRentang(h: Holiday): string {
  const opt: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const mulai = new Date(h.tanggalMulai).toLocaleDateString(LOCALE, opt);
  if (h.tanggalMulai === h.tanggalAkhir) return mulai;
  const akhir = new Date(h.tanggalAkhir).toLocaleDateString(LOCALE, opt);
  return `${mulai} – ${akhir}`;
}

const kelompok = computed(() => [
  {
    nama: "Akan datang",
    items: props.holidays.filter((h) => h.tanggalAkhir >= hariIni),
  },
  {
    nama: "Sudah lewat",
    items: props.holidays.filter((h) => h.tanggalAkhir < hariIni),
  },
]);
</script>

<template>
  <template v-for="(grup, index) in kelompok" :key="grup.nama">
    <SidebarGroup v-if="grup.items.length > 0" class="py-2.5">
      <Collapsible :default-open="index === 0" class="group/collapsible">
        <SidebarGroupLabel as-child class="group/label w-full text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
          <CollapsibleTrigger>
            {{ grup.nama }}
            <ChevronRight class="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem v-for="h in grup.items" :key="h.id">
                <SidebarMenuButton>
                  <span class="size-1.5 shrink-0 rounded-full bg-sidebar-foreground/50" />
                  <span class="truncate">{{ h.nama }}</span>
                  <span class="ml-auto shrink-0 text-xs text-muted-foreground">{{ formatRentang(h) }}</span>
                </SidebarMenuButton>
                <SidebarMenuAction v-if="canManage" show-on-hover :aria-label="`Hapus ${h.nama}`" @click="emit('delete', h.id)">
                  <Trash2 />
                </SidebarMenuAction>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
    <SidebarSeparator class="mx-0" />
  </template>
</template>
