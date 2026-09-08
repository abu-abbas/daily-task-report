<script setup lang="ts">
import { useTemplateRef } from "vue";
import { toast } from "vue-sonner";
import { Paperclip, Trash2 } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ApiError, attachmentFileUrl, type AttachmentItem } from "@/lib/api";
import { useDeleteAttachment, useUploadAttachment } from "@/composables/useTaskLogs";

const props = defineProps<{
  taskLogId: number | null;
  items: AttachmentItem[];
}>();

const MAX_FILES_PER_LOG = 5;
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

const uploadMutation = useUploadAttachment();
const deleteMutation = useDeleteAttachment();

const fileInput = useTemplateRef<HTMLInputElement>("fileInput");

function bukaDialogFile() {
  fileInput.value?.click();
}

// Validasi ringan di klien (fail-fast, hemat round-trip) — validasi asli tetap di server
// (signature file sungguhan + hitungan dari DB, ADR-0016), ini cuma UX.
async function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file || props.taskLogId === null) return;

  if (!["image/jpeg", "image/png"].includes(file.type)) {
    toast.error("Hanya file JPG/PNG yang diizinkan.");
    return;
  }
  if (file.size > MAX_SIZE_BYTES) {
    toast.error("Ukuran file maksimal 5 MB.");
    return;
  }

  try {
    await uploadMutation.mutateAsync({ taskLogId: props.taskLogId, file });
  } catch (err) {
    toast.error(err instanceof ApiError ? err.message : "Gagal unggah lampiran, coba lagi.");
  }
}

async function remove(id: number) {
  try {
    await deleteMutation.mutateAsync(id);
  } catch (err) {
    toast.error(err instanceof ApiError ? err.message : "Gagal menghapus lampiran, coba lagi.");
  }
}
</script>

<template>
  <div class="grid gap-1.5">
    <div v-if="items.length > 0" class="flex flex-wrap gap-2">
      <div v-for="a in items" :key="a.id" class="group relative">
        <a :href="attachmentFileUrl(a.id)" target="_blank" rel="noopener">
          <img
            :src="attachmentFileUrl(a.id)"
            :alt="a.namaAsli"
            :title="a.namaAsli"
            class="size-16 rounded-md border object-cover"
          />
        </a>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              type="button"
              variant="destructive"
              size="icon-xs"
              aria-label="Hapus lampiran"
              class="absolute -right-1.5 -top-1.5 opacity-0 transition-opacity group-hover:opacity-100"
              :disabled="deleteMutation.isPending.value"
              @click="remove(a.id)"
            >
              <Trash2 class="size-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Hapus</TooltipContent>
        </Tooltip>
      </div>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="image/jpeg,image/png"
      class="hidden"
      @change="onFileSelected"
    />
    <Button
      v-if="taskLogId !== null && items.length < MAX_FILES_PER_LOG"
      type="button"
      size="sm"
      variant="outline"
      class="justify-self-start"
      :disabled="uploadMutation.isPending.value"
      @click="bukaDialogFile"
    >
      <Paperclip class="mr-1 size-4" />
      {{ uploadMutation.isPending.value ? "Mengunggah..." : "Lampiran" }}
    </Button>
  </div>
</template>
