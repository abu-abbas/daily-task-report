<script setup lang="ts">
import { useTemplateRef } from "vue";
import { toast } from "vue-sonner";
import { Paperclip, X } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from "@/components/ui/attachment";
import { ApiError, attachmentFileUrl, type AttachmentItem } from "@/lib/api";
import { formatUkuranFile, labelTipeFile } from "@/lib/attachment";
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
    <AttachmentGroup v-if="items.length > 0">
      <Attachment v-for="a in items" :key="a.id" orientation="vertical">
        <AttachmentTrigger as="a" :href="attachmentFileUrl(a.id)" target="_blank" rel="noopener" :aria-label="`Buka ${a.namaAsli}`" />
        <AttachmentMedia variant="image">
          <img :src="attachmentFileUrl(a.id)" :alt="a.namaAsli" />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>{{ a.namaAsli }}</AttachmentTitle>
          <AttachmentDescription>{{ labelTipeFile(a.fileType) }} · {{ formatUkuranFile(a.ukuranBytes) }}</AttachmentDescription>
        </AttachmentContent>
        <AttachmentActions>
          <AttachmentAction
            aria-label="Hapus lampiran"
            :disabled="deleteMutation.isPending.value"
            @click="remove(a.id)"
          >
            <X class="size-3.5" />
          </AttachmentAction>
        </AttachmentActions>
      </Attachment>
    </AttachmentGroup>

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
