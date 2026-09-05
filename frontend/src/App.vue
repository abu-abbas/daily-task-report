<script setup lang="ts">
import { useRoute } from "vue-router";
import AppShell from "@/components/layout/AppShell.vue";
import { Toaster } from "@/components/ui/sonner";

const route = useRoute();
</script>

<template>
  <template v-if="route.meta.public">
    <RouterView />
  </template>
  <AppShell v-else>
    <RouterView />
  </AppShell>
  <Toaster />
</template>
