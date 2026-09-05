<script setup lang="ts">
import { useRouter } from "vue-router";
import { Moon, Sun, LogOut } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/composables/useTheme";
import { useLogout, useMe } from "@/composables/useAuth";

const { theme, toggle } = useTheme();
const me = useMe();
const logout = useLogout();
const router = useRouter();

async function handleLogout() {
  await logout.mutateAsync();
  router.push("/login");
}
</script>

<template>
  <div class="flex min-h-svh flex-col">
    <header class="border-b">
      <div class="mx-auto flex max-w-2xl items-center justify-between gap-4 p-4">
        <nav class="flex items-center gap-4">
          <RouterLink to="/input" class="text-sm font-medium" active-class="text-primary">
            Input
          </RouterLink>
          <RouterLink to="/riwayat" class="text-sm font-medium" active-class="text-primary">
            Riwayat
          </RouterLink>
        </nav>

        <div class="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Ganti tema" @click="toggle">
            <Sun v-if="theme === 'dark'" class="size-4" />
            <Moon v-else class="size-4" />
          </Button>

          <DropdownMenu v-if="me.data.value?.user">
            <DropdownMenuTrigger as-child>
              <Button variant="outline" size="sm">{{ me.data.value.user.nama }}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{{ me.data.value.user.email }}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem @click="handleLogout">
                <LogOut class="mr-2 size-4" />
                Keluar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>

    <main class="mx-auto w-full max-w-2xl flex-1 p-4">
      <slot />
    </main>
  </div>
</template>
