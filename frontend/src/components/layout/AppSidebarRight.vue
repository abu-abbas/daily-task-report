<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { DateFormatter, parseDate, startOfMonth, today, type DateValue } from "@internationalized/date";
import { toast } from "vue-sonner";
import { LOCALE, TIMEZONE } from "@/lib/locale";
import { CalendarIcon, Moon, Plus, Sun } from "@lucide/vue";
import { useTheme } from "@/composables/useTheme";
import { useMe } from "@/composables/useAuth";
import { useCreateHoliday, useDeleteHoliday, useHolidaysQuery } from "@/composables/useHolidays";
import { ApiError } from "@/lib/api";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import HolidayList from "@/components/layout/nav/HolidayList.vue";

const { theme, toggle } = useTheme();
const me = useMe();
const canManage = computed(() => me.data.value?.user.roles.includes("admin") ?? false);

const holidaysQuery = useHolidaysQuery();
const holidays = computed(() => holidaysQuery.data.value?.holidays ?? []);
const createHolidayMutation = useCreateHoliday();
const deleteHolidayMutation = useDeleteHoliday();

const dialogOpen = ref(false);
const confirmOpen = ref(false);
const nama = ref("");
const tanggalMulai = ref("");
const tanggalAkhir = ref("");
const formError = ref<string | null>(null);
const dateFormatter = new DateFormatter(LOCALE, { dateStyle: "long", timeZone: TIMEZONE });
const defaultDate = today(TIMEZONE);

// Kalender bulanan di sidebar (ADR-0044) — klik tanggal buka laporan tanggal itu di /input,
// bukan cuma dekorasi. Dibatasi bulan berjalan, sama seperti date-picker di InputHarianView.
const router = useRouter();
const route = useRoute();
const minReportDate = startOfMonth(defaultDate);

const selectedReportDate = computed<DateValue>(() => {
  const tanggal = typeof route.query.tanggal === "string" ? route.query.tanggal : null;
  return tanggal ? parseDate(tanggal) : defaultDate;
});

function bukaLaporanTanggal(value: DateValue | undefined) {
  if (!value) return;
  router.push({ path: "/input", query: { tanggal: value.toString() } });
}

// DialogTrigger sendiri sudah men-toggle dialogOpen lewat onClick bawaan reka-ui.
// Kalau di sini juga di-set imperatif lewat @click pada elemen yang sama, kedua handler
// bisa berebut urutan eksekusi dan saling membatalkan (toggle balik ke tertutup begitu
// terbuka). Reset field lewat watch supaya cuma bereaksi terhadap perubahan open, bukan
// ikut memutuskan apakah dialog terbuka atau tidak.
watch(dialogOpen, (open) => {
  if (!open) return;
  nama.value = "";
  tanggalMulai.value = "";
  tanggalAkhir.value = "";
  formError.value = null;
});

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

async function confirmTambah() {
  try {
    await createHolidayMutation.mutateAsync({
      nama: nama.value,
      tanggalMulai: tanggalMulai.value,
      tanggalAkhir: tanggalAkhir.value,
    });
    toast.success(`Libur "${nama.value}" ditambahkan.`);
    confirmOpen.value = false;
    dialogOpen.value = false;
  } catch (err) {
    confirmOpen.value = false;
    formError.value = err instanceof ApiError ? err.message : "Gagal menyimpan, coba lagi.";
    dialogOpen.value = true;
  }
}

// deleteConfirmOpen (visibilitas dialog) dan deleteTarget (data yang mau dihapus) sengaja
// dipisah: AlertDialogAction bawaan reka-ui punya onClick sendiri buat menutup dialog, dan
// itu jalan SEBELUM @click="confirmDelete" milik kita (urutan gabungan handler klik). Kalau
// deleteTarget ikut di-null-kan lewat event tutup dialog itu, confirmDelete() akan membaca
// null duluan dan gagal diam-diam tanpa pernah memanggil API hapus.
const deleteConfirmOpen = ref(false);
const deleteTarget = ref<{ id: number; nama: string } | null>(null);

function requestDelete(id: number) {
  const holiday = holidays.value.find((h) => h.id === id);
  if (!holiday) return;
  deleteTarget.value = { id: holiday.id, nama: holiday.nama };
  deleteConfirmOpen.value = true;
}

async function confirmDelete() {
  const target = deleteTarget.value;
  if (!target) return;
  try {
    await deleteHolidayMutation.mutateAsync(target.id);
    toast.success(`Libur "${target.nama}" dihapus.`);
  } catch (err) {
    toast.error(err instanceof ApiError ? err.message : "Gagal menghapus, coba lagi.");
  } finally {
    deleteConfirmOpen.value = false;
    deleteTarget.value = null;
  }
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
          <Calendar
            class="bg-sidebar **:[[role=gridcell]]:w-8.25"
            :model-value="selectedReportDate"
            :min-value="minReportDate"
            :max-value="defaultDate"
            @update:model-value="bukaLaporanTanggal"
          />
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarSeparator class="mx-0" />
      <HolidayList :holidays="holidays" :can-manage="canManage" @delete="requestDelete" />
    </SidebarContent>
    <SidebarFooter v-if="canManage">
      <Dialog v-model:open="dialogOpen">
        <DialogTrigger as-child>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton>
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
              <Popover v-slot="{ close }">
                <PopoverTrigger as-child>
                  <Button id="holiday-mulai" variant="outline" class="justify-start text-left font-normal" :class="{ 'text-muted-foreground': !tanggalMulai }">
                    <CalendarIcon aria-hidden="true" />
                    {{ tanggalMulai ? dateFormatter.format(parseDate(tanggalMulai).toDate(TIMEZONE)) : "Pilih tanggal mulai" }}
                  </Button>
                </PopoverTrigger>
                <PopoverContent class="z-60 w-auto p-0" align="start">
                  <Calendar
                    :model-value="tanggalMulai ? parseDate(tanggalMulai) : undefined"
                    :default-placeholder="defaultDate"
                    :locale="LOCALE"
                    layout="month-and-year"
                    initial-focus
                    @update:model-value="(value) => { tanggalMulai = value?.toString() ?? ''; close(); }"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div class="grid gap-2">
              <Label for="holiday-akhir">Tanggal akhir</Label>
              <Popover v-slot="{ close }">
                <PopoverTrigger as-child>
                  <Button id="holiday-akhir" variant="outline" class="justify-start text-left font-normal" :class="{ 'text-muted-foreground': !tanggalAkhir }">
                    <CalendarIcon aria-hidden="true" />
                    {{ tanggalAkhir ? dateFormatter.format(parseDate(tanggalAkhir).toDate(TIMEZONE)) : "Pilih tanggal akhir" }}
                  </Button>
                </PopoverTrigger>
                <PopoverContent class="z-60 w-auto p-0" align="start">
                  <Calendar
                    :model-value="tanggalAkhir ? parseDate(tanggalAkhir) : undefined"
                    :default-placeholder="tanggalMulai ? parseDate(tanggalMulai) : defaultDate"
                    :locale="LOCALE"
                    layout="month-and-year"
                    initial-focus
                    @update:model-value="(value) => { tanggalAkhir = value?.toString() ?? ''; close(); }"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <p v-if="formError" class="text-sm text-destructive">{{ formError }}</p>
          </div>
          <DialogFooter>
            <Button :disabled="createHolidayMutation.isPending.value" @click="submitForm">
              {{ createHolidayMutation.isPending.value ? "Menyimpan..." : "Simpan" }}
            </Button>
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
            <AlertDialogCancel :disabled="createHolidayMutation.isPending.value">Batal</AlertDialogCancel>
            <AlertDialogAction :disabled="createHolidayMutation.isPending.value" @click="confirmTambah">
              Ya, simpan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog v-model:open="deleteConfirmOpen">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus libur ini?</AlertDialogTitle>
            <AlertDialogDescription>{{ deleteTarget?.nama }}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel :disabled="deleteHolidayMutation.isPending.value">Batal</AlertDialogCancel>
            <AlertDialogAction :disabled="deleteHolidayMutation.isPending.value" @click="confirmDelete">
              Ya, hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarFooter>
  </Sidebar>
</template>
