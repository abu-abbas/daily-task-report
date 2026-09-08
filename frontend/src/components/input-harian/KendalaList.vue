<script setup lang="ts">
import { computed, ref } from "vue";
import { toast } from "vue-sonner";
import { CircleCheck, Trash2 } from "@lucide/vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ApiError, type KendalaItem } from "@/lib/api";
import { useCreateKendala, useDeleteKendala, useResolveKendala } from "@/composables/useTaskLogs";

const props = defineProps<{
  taskLogId: number | null;
  items: KendalaItem[];
}>();

const createMutation = useCreateKendala();
const deleteMutation = useDeleteKendala();
const resolveMutation = useResolveKendala();

const adaKendalaBelumSelesai = computed(() => props.items.some((k) => k.status === "open"));

const formOpen = ref(false);
const draftDeskripsi = ref("");

// Kendala cuma bisa ditambahkan ke log yang sudah tersimpan (ADR-0015) — endpoint independen
// dari simpan harian, langsung panggil API begitu diklik, bukan ikut tombol Simpan besar.
async function submitKendala() {
  if (props.taskLogId === null || !draftDeskripsi.value.trim()) return;
  try {
    await createMutation.mutateAsync({ taskLogId: props.taskLogId, deskripsi: draftDeskripsi.value.trim() });
    draftDeskripsi.value = "";
    formOpen.value = false;
  } catch (err) {
    toast.error(err instanceof ApiError ? err.message : "Gagal menambah kendala, coba lagi.");
  }
}

async function resolve(id: number) {
  try {
    await resolveMutation.mutateAsync(id);
  } catch (err) {
    toast.error(err instanceof ApiError ? err.message : "Gagal menandai kendala selesai, coba lagi.");
  }
}

async function remove(id: number) {
  try {
    await deleteMutation.mutateAsync(id);
  } catch (err) {
    toast.error(err instanceof ApiError ? err.message : "Gagal menghapus kendala, coba lagi.");
  }
}

function batalTambah() {
  formOpen.value = false;
  draftDeskripsi.value = "";
}
</script>

<template>
  <div class="grid gap-1.5">
    <div
      v-if="items.length > 0"
      class="grid gap-1.5 rounded-md border border-dashed p-2 text-xs"
      :class="adaKendalaBelumSelesai && 'bg-destructive/5'"
    >
      <Badge variant="outline" class="w-fit shrink-0">
        <div class="bg-destructive size-1.5 rounded-full"></div>
        Kendala <span v-if="items.length > 1">({{ items.length }})</span>
      </Badge>
      <div
        v-for="k in items"
        :key="k.id"
        class="flex items-center justify-between gap-2 border-t pt-1.5 first:border-t-0 first:pt-0"
      >
        <span class="flex items-center gap-1.5">
          <CircleCheck v-if="k.status === 'resolved'" class="size-3 stroke-green-500" />
          <span>{{ k.deskripsi }}</span>
        </span>
        <div class="flex shrink-0 items-center gap-1">
          <Tooltip v-if="k.status === 'open'">
            <TooltipTrigger as-child>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Tandai selesai"
                :disabled="resolveMutation.isPending.value"
                @click="resolve(k.id)"
              >
                <CircleCheck class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Tandai selesai</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Hapus kendala"
                :disabled="deleteMutation.isPending.value"
                @click="remove(k.id)"
              >
                <Trash2 class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Hapus</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>

    <div v-if="formOpen" class="grid gap-1.5">
      <Textarea v-model="draftDeskripsi" placeholder="Ceritakan kendala pada pekerjaan ini" rows="2" />
      <div class="flex gap-1.5">
        <Button size="sm" :disabled="!draftDeskripsi.trim() || createMutation.isPending.value" @click="submitKendala">
          {{ createMutation.isPending.value ? "Menyimpan..." : "Tambah" }}
        </Button>
        <Button type="button" size="sm" variant="ghost" @click="batalTambah">Batal</Button>
      </div>
    </div>

    <Button
      v-else-if="taskLogId !== null"
      type="button"
      size="sm"
      variant="outline"
      class="justify-self-start"
      @click="formOpen = true"
    >
      + Tambah kendala
    </Button>
  </div>
</template>
