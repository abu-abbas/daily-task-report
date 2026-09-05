<script setup lang="ts">
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
// @vee-validate/zod masih pin peer zod ^3, jadi pakai API zod v3 (bukan "zod/v4" seperti di backend).
import { z } from "zod";
import { useRouter, useRoute } from "vue-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLogin } from "@/composables/useAuth";
import { ApiError } from "@/lib/api";

const router = useRouter();
const route = useRoute();
const login = useLogin();

const formSchema = toTypedSchema(
  z.object({
    email: z.string().email("Email tidak valid."),
    password: z.string().min(1, "Password wajib diisi."),
  }),
);

const form = useForm({ validationSchema: formSchema });

const onSubmit = form.handleSubmit(async (values) => {
  try {
    await login.mutateAsync(values);
    const redirect = typeof route.query.redirect === "string" ? route.query.redirect : "/input";
    router.push(redirect);
  } catch (err) {
    form.setFieldError(
      "password",
      err instanceof ApiError ? err.message : "Gagal masuk, coba lagi.",
    );
  }
});
</script>

<template>
  <div class="flex min-h-svh items-center justify-center p-4">
    <Card class="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Masuk — Laporan Harian</CardTitle>
      </CardHeader>
      <CardContent>
        <form class="grid gap-4" @submit="onSubmit" novalidate>
          <FormField v-slot="{ componentField }" name="email">
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autocomplete="username" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="password">
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" autocomplete="current-password" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <Button type="submit" class="w-full" :disabled="login.isPending.value">
            {{ login.isPending.value ? "Memeriksa..." : "Masuk" }}
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
