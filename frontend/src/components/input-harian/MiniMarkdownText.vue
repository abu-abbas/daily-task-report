<script lang="ts">
import { defineComponent, h, type VNode } from "vue";

function parseInline(text: string): (VNode | string)[] {
  const nodes: (VNode | string)[] = [];
  const pattern = /(\*[^*\n]+\*|_[^_\n]+_)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith("*")) nodes.push(h("strong", token.slice(1, -1)));
    else nodes.push(h("em", token.slice(1, -1)));
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

// Checkbox opsional (ADR-0043) — dipakai sebagai todo-list personal di catatan rencana, bukan
// data terstruktur; centang cuma mengubah teks markdown-nya sendiri.
const CHECKBOX_RE = /^- \[([ xX])\] (.*)$/;

type ListMode = "none" | "bullet" | "checkbox";

function parseBlocks(text: string, interactive: boolean, onToggle: (lineIndex: number) => void): VNode[] {
  const blocks: VNode[] = [];
  let mode: ListMode = "none";
  let items: VNode[] = [];

  const flushItems = () => {
    if (items.length === 0) return;
    const listClass = mode === "checkbox" ? "grid list-none gap-0.5 pl-0" : "list-disc pl-4";
    blocks.push(h("ul", { class: listClass }, items));
    items = [];
    mode = "none";
  };

  text.split("\n").forEach((line, index) => {
    const checkboxMatch = line.match(CHECKBOX_RE);
    if (checkboxMatch) {
      if (mode !== "checkbox") flushItems();
      mode = "checkbox";
      const checked = checkboxMatch[1].toLowerCase() === "x";
      items.push(
        h("li", { class: "flex items-start gap-1.5" }, [
          h("input", {
            type: "checkbox",
            checked,
            disabled: !interactive,
            class: "mt-0.5 size-3.5 shrink-0 accent-primary disabled:cursor-default",
            onChange: interactive ? () => onToggle(index) : undefined,
          }),
          h("span", { class: checked ? "text-muted-foreground line-through" : "" }, parseInline(checkboxMatch[2]!)),
        ]),
      );
      return;
    }
    if (line.startsWith("- ")) {
      if (mode !== "bullet") flushItems();
      mode = "bullet";
      items.push(h("li", {}, parseInline(line.slice(2))));
      return;
    }
    flushItems();
    blocks.push(h("p", { class: "min-h-[1em]" }, parseInline(line)));
  });
  flushItems();
  return blocks;
}

export default defineComponent({
  name: "MiniMarkdownText",
  props: {
    text: { type: String, default: "" },
    interactive: { type: Boolean, default: false },
  },
  emits: ["toggle-checkbox"],
  setup(props, { emit }) {
    return () =>
      h(
        "div",
        { class: "grid gap-0.5" },
        parseBlocks(props.text, props.interactive, (lineIndex) => emit("toggle-checkbox", lineIndex)),
      );
  },
});
</script>
