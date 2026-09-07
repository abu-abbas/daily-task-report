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

function parseBlocks(text: string): VNode[] {
  const blocks: VNode[] = [];
  let bulletLines: string[] = [];

  const flushBullets = () => {
    if (bulletLines.length === 0) return;
    blocks.push(h("ul", { class: "list-disc pl-4" }, bulletLines.map((line) => h("li", parseInline(line)))));
    bulletLines = [];
  };

  for (const line of text.split("\n")) {
    if (line.startsWith("- ")) {
      bulletLines.push(line.slice(2));
      continue;
    }
    flushBullets();
    blocks.push(h("p", { class: "min-h-[1em]" }, parseInline(line)));
  }
  flushBullets();
  return blocks;
}

export default defineComponent({
  name: "MiniMarkdownText",
  props: {
    text: { type: String, default: "" },
  },
  setup(props) {
    return () => h("div", { class: "grid gap-0.5" }, parseBlocks(props.text));
  },
});
</script>
