<script setup lang="ts">
import { Badge } from "@/components/ui/badge";

defineProps<{
  nama: string;
}>();
</script>

<template>
  <Badge variant="outline" class="gap-1.5 border-transparent bg-muted">
    <span class="size-1.5 shrink-0 rounded-full bg-primary" />
    {{ nama }}
  </Badge>
</template>
