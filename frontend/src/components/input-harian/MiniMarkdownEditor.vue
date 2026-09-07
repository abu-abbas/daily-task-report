<script setup lang="ts">
import { ref, useTemplateRef } from "vue";
import { useVModel } from "@vueuse/core";
import { Bold, Eye, EyeOff, Italic, List, ListTodo } from "@lucide/vue";
import { Textarea } from "@/components/ui/textarea";
import MiniMarkdownText from "@/components/input-harian/MiniMarkdownText.vue";

const props = defineProps<{
  modelValue: string;
  placeholder?: string;
  ariaLabel?: string;
  rows?: string | number;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", payload: string): void;
}>();

const value = useVModel(props, "modelValue", emit, { passive: true });
const textareaRef = useTemplateRef<{ $el: HTMLTextAreaElement }>("textareaRef");
const showPreview = ref(false);

function withSelection(fn: (el: HTMLTextAreaElement, start: number, end: number) => void) {
  const el = textareaRef.value?.$el;
  if (!el) return;
  fn(el, el.selectionStart, el.selectionEnd);
}

function wrapSelection(before: string, after = before) {
  withSelection((el, start, end) => {
    const selected = value.value.slice(start, end);
    value.value = value.value.slice(0, start) + before + selected + after + value.value.slice(end);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  });
}

function toggleLinePrefix(addPrefix: string, stripPattern: RegExp) {
  withSelection((el, start, end) => {
    const text = value.value;
    const lineStart = text.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = text.indexOf("\n", end) === -1 ? text.length : text.indexOf("\n", end);
    const lines = text.slice(lineStart, lineEnd).split("\n");
    const allPrefixed = lines.every((l) => l.trim() === "" || stripPattern.test(l));
    const nextLines = lines.map((l) => {
      if (l.trim() === "") return l;
      return allPrefixed ? l.replace(stripPattern, "") : `${addPrefix}${l.replace(/^- /, "")}`;
    });
    const nextBlock = nextLines.join("\n");
    value.value = text.slice(0, lineStart) + nextBlock + text.slice(lineEnd);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(lineStart, lineStart + nextBlock.length);
    });
  });
}

function toggleBullet() {
  toggleLinePrefix("- ", /^- /);
}

// Checkbox todo-list opsional (ADR-0043) — sintaks sama dengan bullet, cuma ditambah "[ ] ".
function toggleTodo() {
  toggleLinePrefix("- [ ] ", /^- \[[ xX]\] /);
}
</script>

<template>
  <div
    class="focus-within:border-ring focus-within:ring-ring/50 dark:bg-input/30 rounded-lg border border-input transition-colors focus-within:ring-3"
  >
    <div class="flex items-center justify-between border-b border-input px-1.5 py-1">
      <div class="flex gap-1">
        <button type="button" class="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50" title="Tebal" :disabled="showPreview" @click="wrapSelection('*')">
          <Bold class="size-3.5" />
        </button>
        <button type="button" class="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50" title="Miring" :disabled="showPreview" @click="wrapSelection('_')">
          <Italic class="size-3.5" />
        </button>
        <button type="button" class="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50" title="Bullet" :disabled="showPreview" @click="toggleBullet">
          <List class="size-3.5" />
        </button>
        <button type="button" class="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50" title="Checklist" :disabled="showPreview" @click="toggleTodo">
          <ListTodo class="size-3.5" />
        </button>
      </div>
      <button
        type="button"
        class="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        :title="showPreview ? 'Tutup preview' : 'Preview'"
        @click="showPreview = !showPreview"
      >
        <EyeOff v-if="showPreview" class="size-3.5" />
        <Eye v-else class="size-3.5" />
      </button>
    </div>
    <p v-if="showPreview && !value" class="min-h-16 px-2.5 py-2 text-sm text-muted-foreground">
      {{ placeholder }}
    </p>
    <MiniMarkdownText v-else-if="showPreview" :text="value" class="min-h-16 px-2.5 py-2 text-sm" />
    <Textarea
      v-else
      ref="textareaRef"
      v-model="value"
      :placeholder="placeholder"
      :aria-label="ariaLabel"
      :rows="rows"
      class="rounded-t-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
    />
  </div>
</template>
