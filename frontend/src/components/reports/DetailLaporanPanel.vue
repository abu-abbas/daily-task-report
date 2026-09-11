<script setup lang="ts">
// Isi bagian laporan yang bukan realisasi harian (ADR-0019): template Word milik sendiri (dipakai
// mail-merge) dan Saran dan Rekomendasi. Cover/Pendahuluan/Ruang Lingkup/Jabatan/Kontrak sengaja
// TIDAK ada di sini lagi — statis di file template masing-masing orang, mesin yang sempat dibangun
// untuk itu sudah dihapus (lihat ADR-0019, sekaligus riwayat kenapa).
import { computed, ref, watch } from "vue";
import { toast } from "vue-sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import { useSaranQuery, useSaveSaran } from "@/composables/useSaran";
import {
  useDeleteLaporanTemplate,
  useLaporanTemplateQuery,
  useUploadLaporanTemplate,
} from "@/composables/useLaporanTemplate";

const props = defineProps<{ bulan: string }>();
const bulanRef = computed(() => props.bulan);

// --- Template Word milik sendiri (ADR-0019 revisi 2026-09-11) — dipakai mail-merge laporan ---
const laporanTemplateQuery = useLaporanTemplateQuery();
const uploadTemplateMutation = useUploadLaporanTemplate();
const deleteTemplateMutation = useDeleteLaporanTemplate();
const templateFileInput = ref<HTMLInputElement | null>(null);

function pilihFileTemplate() {
  templateFileInput.value?.click();
}

async function onFileTemplateDipilih(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    await uploadTemplateMutation.mutateAsync(file);
    toast.success(`Template "${file.name}" disimpan.`);
  } catch (err) {
    toast.error(err instanceof ApiError ? err.message : "Gagal mengunggah template.");
  } finally {
    if (templateFileInput.value) templateFileInput.value.value = "";
  }
}

async function hapusTemplate() {
  try {
    await deleteTemplateMutation.mutateAsync();
    toast.success("Template dihapus.");
  } catch (err) {
    toast.error(err instanceof ApiError ? err.message : "Gagal menghapus template.");
  }
}

// --- Saran dan Rekomendasi (opsional — kosong berarti tidak ditampilkan di laporan) ---
const saranQuery = useSaranQuery(bulanRef);
const saveSaranMutation = useSaveSaran(bulanRef);
const saranIsi = ref("");

watch(
  () => saranQuery.data.value,
  (data) => {
    saranIsi.value = data?.isi ?? "";
  },
  { immediate: true },
);

async function simpanSaran() {
  try {
    await saveSaranMutation.mutateAsync(saranIsi.value);
    toast.success("Saran dan Rekomendasi disimpan.");
  } catch (err) {
    toast.error(err instanceof ApiError ? err.message : "Gagal menyimpan Saran.");
  }
}
</script>

<template>
  <div class="grid gap-6">
    <section class="grid gap-3 rounded-md border p-4">
      <h3 class="font-medium">Template Word</h3>
      <p class="text-sm text-muted-foreground">
        Laporan diunduh sebagai Word hasil isi-otomatis ke template Anda sendiri — nama, timesheet, tabel aktifitas,
        lampiran, dan saran diisi otomatis; sisanya ikut apa yang ada di file template Anda.
      </p>
      <template v-if="laporanTemplateQuery.isPending.value">
        <p class="text-sm text-muted-foreground">Memuat...</p>
      </template>
      <template v-else-if="laporanTemplateQuery.data.value?.template">
        <p class="text-sm">
          File saat ini: <span class="font-medium">{{ laporanTemplateQuery.data.value.template.namaAsli }}</span>
        </p>
        <div class="flex gap-2">
          <Button variant="outline" :disabled="uploadTemplateMutation.isPending.value" @click="pilihFileTemplate">
            Ganti file
          </Button>
          <Button variant="outline" :disabled="deleteTemplateMutation.isPending.value" @click="hapusTemplate">
            Hapus
          </Button>
        </div>
      </template>
      <template v-else>
        <p class="text-sm text-muted-foreground">Belum ada template. Unggah file .docx Anda sendiri dulu.</p>
        <Button class="w-fit" :disabled="uploadTemplateMutation.isPending.value" @click="pilihFileTemplate">
          {{ uploadTemplateMutation.isPending.value ? "Mengunggah..." : "Unggah template (.docx)" }}
        </Button>
      </template>
      <input ref="templateFileInput" type="file" accept=".docx" class="hidden" @change="onFileTemplateDipilih" />
    </section>

    <section class="grid gap-3 rounded-md border p-4">
      <div class="flex items-center justify-between">
        <h3 class="font-medium">Saran dan Rekomendasi</h3>
        <Badge v-if="!saranIsi.trim()" variant="secondary">Kosong = tidak ditampilkan di laporan</Badge>
      </div>
      <div class="grid gap-2">
        <Label>Daftar saran (satu per baris)</Label>
        <Textarea v-model="saranIsi" rows="4" placeholder="Penerapan proses CI/CD...&#10;Penerapan Test Unit..." />
      </div>
      <Button class="w-fit" :disabled="saveSaranMutation.isPending.value" @click="simpanSaran">
        {{ saveSaranMutation.isPending.value ? "Menyimpan..." : "Simpan Saran" }}
      </Button>
    </section>
  </div>
</template>
