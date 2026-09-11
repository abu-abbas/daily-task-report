<script setup lang="ts">
import { computed, ref } from "vue";
import { ChevronLeft, ChevronRight, FileSearch, FileDown, Paperclip } from "@lucide/vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import MiniMarkdownText from "@/components/input-harian/MiniMarkdownText.vue";
import TimesheetPreview from "@/components/reports/TimesheetPreview.vue";
import DetailLaporanPanel from "@/components/reports/DetailLaporanPanel.vue";
import { LOCALE } from "@/lib/locale";
import { monthlyReportWordUrl } from "@/lib/api";
import { useMonthlyReportPreviewQuery } from "@/composables/useReports";
import { useLaporanTemplateQuery } from "@/composables/useLaporanTemplate";

function bulanSekarangStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// Bulan yang lagi dipilih untuk laporan — default bulan berjalan. Dipisah dari "Tampilkan":
// milih bulan cuma ganti state, tidak langsung fetch/unduh (beda dari widget lama di Riwayat).
const bulanTerpilih = ref(bulanSekarangStr());
const sudahTampil = ref(false);

// Popover dua-tampilan (daftar 3 bulan terbaru, lalu grid bulan/tahun kalau "Bulan lainnya"
// diklik) — SENGAJA satu Popover, bukan DropdownMenu+Popover terpisah. Ditemukan sebelumnya
// (widget yang sama di RiwayatView.vue): menutup DropdownMenu mengembalikan focus ke tombol
// trigger, yang oleh Popover manapun yang baru dibuka dianggap "focus di luar" dan langsung
// membatalkannya. Toggle tampilan di dalam SATU overlay yang sama menghindari race itu.
const laporanPopoverOpen = ref(false);
const tampilkanPemilihBulan = ref(false);
function tutupLaporanPopover(open: boolean) {
  laporanPopoverOpen.value = open;
  if (!open) tampilkanPemilihBulan.value = false;
}

const bulanFormatter = new Intl.DateTimeFormat(LOCALE, { month: "long", year: "numeric" });
interface BulanOpsi {
  bulan: string;
  label: string;
}
const bulanTerbaruOptions = computed<BulanOpsi[]>(() => {
  const now = new Date();
  return Array.from({ length: 3 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const bulan = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { bulan, label: bulanFormatter.format(d) };
  });
});

const bulanLainnyaTahun = ref(new Date().getFullYear());
const NAMA_BULAN_PENDEK_FMT = new Intl.DateTimeFormat(LOCALE, { month: "short" });
const namaBulanPendek = Array.from({ length: 12 }, (_, i) => NAMA_BULAN_PENDEK_FMT.format(new Date(2000, i, 1)));

function pilihBulan(bulan: string) {
  bulanTerpilih.value = bulan;
  tutupLaporanPopover(false);
}
function pilihBulanLainnya(bulanIndex: number) {
  pilihBulan(`${bulanLainnyaTahun.value}-${String(bulanIndex + 1).padStart(2, "0")}`);
}

const bulanTerpilihLabel = computed(() => {
  const [y, m] = bulanTerpilih.value.split("-").map(Number);
  return bulanFormatter.format(new Date(y!, m! - 1, 1));
});

const previewQuery = useMonthlyReportPreviewQuery(bulanTerpilih, sudahTampil);
const preview = computed(() => previewQuery.data.value);

// Gate ADR-0019 revisi (2026-09-11): tombol unduh Word butuh template milik sendiri sudah
// diunggah — dicek di sini juga (bukan cuma diserahkan ke server) supaya user diarahkan ke tab
// "Detail Laporan" alih-alih baru tahu lewat halaman error JSON mentah setelah klik unduh.
const laporanTemplateQuery = useLaporanTemplateQuery();
const siapUnduh = computed(() => laporanTemplateQuery.data.value?.template != null);

function tanggalKosongLabel(tanggal: string): string {
  return String(Number(tanggal.slice(8, 10)));
}

// Pratinjau ini merepresentasikan isi PDF (catatanToLines di report-pdf.ts menyederhanakan
// checklist jadi bullet polos, status tercentang/belum tidak berarti apa-apa di dokumen cetak)
// — checkbox interaktif punya MiniMarkdownText SENGAJA tidak dipakai di sini biar pratinjau tidak
// menyesatkan (kelihatan bisa dicentang padahal di PDF nanti cuma jadi "•" biasa).
const CHECKBOX_RE = /^- \[([ xX])\] (.*)$/;
function catatanUntukPratinjau(catatan: string): string {
  return catatan
    .split("\n")
    .map((line) => {
      const checkbox = line.match(CHECKBOX_RE);
      return checkbox ? `- ${checkbox[2]}` : line;
    })
    .join("\n");
}
</script>

<template>
  <div class="grid gap-4 pb-24">
    <div>
      <h1 class="text-lg font-semibold">Laporan</h1>
      <p class="text-sm text-muted-foreground">Pratinjau data sebelum diunduh sebagai PDF bulanan.</p>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <ButtonGroup>
        <Popover :open="laporanPopoverOpen" @update:open="tutupLaporanPopover">
          <PopoverTrigger as-child>
            <Button variant="secondary">
              {{ bulanTerpilihLabel }}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" class="w-56 p-1">
            <div v-if="!tampilkanPemilihBulan" class="grid gap-0.5">
              <button
                v-for="opt in bulanTerbaruOptions"
                :key="opt.bulan"
                type="button"
                class="rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                @click="pilihBulan(opt.bulan)"
              >
                {{ opt.label }}
              </button>
              <div class="my-1 border-t" />
              <button
                type="button"
                class="rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                @click="tampilkanPemilihBulan = true"
              >
                Bulan lainnya…
              </button>
            </div>
            <div v-else class="grid gap-1 p-1">
              <div class="flex items-center justify-between pb-1">
                <Button variant="ghost" size="icon" aria-label="Tahun sebelumnya" @click="bulanLainnyaTahun--">
                  <ChevronLeft class="size-4" />
                </Button>
                <span class="text-sm font-medium">{{ bulanLainnyaTahun }}</span>
                <Button variant="ghost" size="icon" aria-label="Tahun berikutnya" @click="bulanLainnyaTahun++">
                  <ChevronRight class="size-4" />
                </Button>
              </div>
              <div class="grid grid-cols-3 gap-1">
                <button
                  v-for="(nama, i) in namaBulanPendek"
                  :key="i"
                  type="button"
                  class="rounded-md border px-2 py-1.5 text-center text-sm hover:bg-accent"
                  @click="pilihBulanLainnya(i)"
                >
                  {{ nama }}
                </button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Button variant="secondary" @click="sudahTampil = true">Tampilkan</Button>
      </ButtonGroup>

      <Tooltip v-if="!preview">
        <TooltipTrigger as-child>
          <!-- disabled:pointer-events-none di Button bikin hover tidak pernah kena tombolnya
               sendiri — dibungkus span (tidak disabled) biar Tooltip tetap bisa muncul. -->
          <span tabindex="0" class="ml-auto inline-block">
            <Button disabled class="pointer-events-none w-full">
              <FileDown class="size-4" />
              Unduh laporan (Word)
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Klik "Tampilkan" dulu buat cek datanya sebelum diunduh</TooltipContent>
      </Tooltip>
      <Tooltip v-else-if="!siapUnduh">
        <TooltipTrigger as-child>
          <span tabindex="0" class="ml-auto inline-block">
            <Button disabled class="pointer-events-none w-full">
              <FileDown class="size-4" />
              Unduh laporan (Word)
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Unggah template Word Anda dulu di tab "Detail Laporan"</TooltipContent>
      </Tooltip>
      <Button v-else as-child class="ml-auto">
        <a :href="monthlyReportWordUrl(bulanTerpilih)" target="_blank">
          <FileDown class="size-4" />
          Unduh laporan (Word)
        </a>
      </Button>
    </div>

    <Empty v-if="!sudahTampil" class="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileSearch />
        </EmptyMedia>
        <EmptyTitle>Belum ditampilkan</EmptyTitle>
        <EmptyDescription>
          Klik "Tampilkan" untuk lihat pratinjau data {{ bulanTerpilihLabel }} sebelum diunduh sebagai Word.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button @click="sudahTampil = true">Tampilkan</Button>
      </EmptyContent>
    </Empty>

    <template v-else>
      <p v-if="previewQuery.isPending.value" class="text-sm text-muted-foreground">Memuat...</p>
      <p v-else-if="previewQuery.isError.value" class="text-sm text-destructive">Gagal memuat, coba muat ulang.</p>
      <template v-else-if="preview">
        <div
          v-if="preview.tanggalKosong.length > 0"
          class="rounded-md border border-dashed border-destructive/50 bg-destructive/5 p-3 text-sm"
        >
          <p class="font-medium text-destructive">
            {{ preview.tanggalKosong.length }} hari kerja belum ada realisasi
          </p>
          <p class="text-muted-foreground">
            Tanggal {{ preview.tanggalKosong.map(tanggalKosongLabel).join(", ") }} — {{ preview.bulanLabel }}
          </p>
        </div>

        <Tabs default-value="daftar">
          <TabsList>
            <TabsTrigger value="daftar">Daftar</TabsTrigger>
            <TabsTrigger value="timesheet">Timesheet</TabsTrigger>
            <TabsTrigger value="detail">
              Detail Laporan
              <Badge v-if="!siapUnduh" variant="destructive" class="ml-1.5 px-1.5 py-0 text-[10px]">!</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="daftar">
            <ScrollArea class="w-full min-w-0 rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Aplikasi/Modul</TableHead>
                    <TableHead>Kegiatan</TableHead>
                    <TableHead>Catatan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Lampiran</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableEmpty v-if="preview.items.length === 0" :colspan="7">
                    Belum ada realisasi di {{ preview.bulanLabel }}.
                  </TableEmpty>
                  <TableRow v-for="(item, i) in preview.items" :key="i">
                    <TableCell class="align-top">{{ item.no }}</TableCell>
                    <TableCell class="align-top whitespace-nowrap">{{ item.tanggalLabel }}</TableCell>
                    <TableCell class="align-top">{{ item.projectNama }}</TableCell>
                    <!-- TableCell.vue bawaan sudah set whitespace-nowrap default — di-override di sini
                         (bukan cuma dihapus) karena kegiatan (tag+deskripsi task) bisa panjang dan
                         kalau dibiarkan nowrap bikin tabel melebar terus ke kanan, bukan wrap. -->
                    <TableCell class="align-top max-w-64 whitespace-normal">{{ item.kegiatan }}</TableCell>
                    <TableCell class="align-top min-w-48">
                      <MiniMarkdownText v-if="item.catatan" :text="catatanUntukPratinjau(item.catatan)" class="whitespace-normal text-xs" />
                    </TableCell>
                    <TableCell class="align-top">
                      <Badge :variant="item.status === 'Selesai' ? 'secondary' : 'outline'">{{ item.status }}</Badge>
                    </TableCell>
                    <TableCell class="align-top">
                      <span v-if="item.lampiranCount > 0" class="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Paperclip class="size-3" />
                        {{ item.lampiranCount }}
                      </span>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="timesheet">
            <TimesheetPreview :timesheet="preview.timesheet" />
          </TabsContent>

          <TabsContent value="detail">
            <DetailLaporanPanel :bulan="bulanTerpilih" />
          </TabsContent>
        </Tabs>
      </template>
    </template>
  </div>
</template>
