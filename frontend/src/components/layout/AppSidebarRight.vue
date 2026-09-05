<script setup lang="ts">
import { ref } from "vue";
import { toast } from "vue-sonner";
import { Moon, Plus, Sun } from "@lucide/vue";
import { useTheme } from "@/composables/useTheme";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import HolidayList, { type Holiday } from "@/components/layout/nav/HolidayList.vue";

const { theme, toggle } = useTheme();

// Data contoh sementara — diganti data holidays sungguhan saat pengelolaan kalender (Stage 2) siap.
// Tanggal ini transkripsi dari referensi libur pengguna (docs/references/holiday-settings.md), bukan daftar resmi.
const holidays = ref<Holiday[]>([
  { nama: "Maulid Nabi Muhammad S.A.W.", tanggalMulai: "2026-08-25", tanggalAkhir: "2026-08-25" },
  { nama: "Cuti Bersama Kelahiran Yesus Kristus", tanggalMulai: "2026-12-24", tanggalAkhir: "2026-12-24" },
  { nama: "Kelahiran Yesus Kristus", tanggalMulai: "2026-12-25", tanggalAkhir: "2026-12-25" },
]);

const dialogOpen = ref(false);
const confirmOpen = ref(false);
const nama = ref("");
const tanggalMulai = ref("");
const tanggalAkhir = ref("");
const formError = ref<string | null>(null);

function openTambah() {
  nama.value = "";
  tanggalMulai.value = "";
  tanggalAkhir.value = "";
  formError.value = null;
  dialogOpen.value = true;
}

function submitForm() {
  if (!nama.value || !tanggalMulai.value || !tanggalAkhir.value) {
    formError.value = "Semua field wajib diisi.";
    return;
  }
  if (tanggalAkhir.value < tanggalMulai.value) {
    formError.value = "Tanggal akhir tidak boleh sebelum tanggal mulai.";
    return;
  }
  formError.value = null;
  confirmOpen.value = true;
}

function confirmTambah() {
  holidays.value.push({ nama: nama.value, tanggalMulai: tanggalMulai.value, tanggalAkhir: tanggalAkhir.value });
  toast.success(`Libur "${nama.value}" ditambahkan.`);
  dialogOpen.value = false;
}
</script>

<template>
  <Sidebar collapsible="none" class="sticky top-0 hidden h-svh border-l lg:flex">
    <SidebarHeader class="h-16 flex-row items-center justify-end border-b border-sidebar-border">
      <Button variant="ghost" size="icon" aria-label="Ganti tema" @click="toggle">
        <Sun v-if="theme === 'dark'" class="size-4" />
        <Moon v-else class="size-4" />
      </Button>
    </SidebarHeader>
    <SidebarContent>
      <SidebarGroup class="px-0">
        <SidebarGroupContent>
          <Calendar class="bg-sidebar [&_[role=gridcell]]:w-[33px]" />
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarSeparator class="mx-0" />
      <HolidayList :holidays="holidays" />
    </SidebarContent>
    <SidebarFooter>
      <Dialog v-model:open="dialogOpen">
        <DialogTrigger as-child>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton @click="openTambah">
                <Plus />
                <span>Tambah libur</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </DialogTrigger>
        <DialogContent class="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Tambah libur</DialogTitle>
          </DialogHeader>
          <div class="grid gap-4">
            <div class="grid gap-2">
              <Label for="holiday-nama">Nama/keterangan</Label>
              <Input id="holiday-nama" v-model="nama" placeholder="Cuti bersama" />
            </div>
            <div class="grid gap-2">
              <Label for="holiday-mulai">Tanggal mulai</Label>
              <Input id="holiday-mulai" v-model="tanggalMulai" type="date" />
            </div>
            <div class="grid gap-2">
              <Label for="holiday-akhir">Tanggal akhir</Label>
              <Input id="holiday-akhir" v-model="tanggalAkhir" type="date" />
            </div>
            <p v-if="formError" class="text-sm text-destructive">{{ formError }}</p>
          </div>
          <DialogFooter>
            <Button @click="submitForm">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog v-model:open="confirmOpen">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tambah libur ini?</AlertDialogTitle>
            <AlertDialogDescription>{{ nama }} — {{ tanggalMulai }} s/d {{ tanggalAkhir }}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction @click="confirmTambah">Ya, simpan</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarFooter>
  </Sidebar>
</template>
