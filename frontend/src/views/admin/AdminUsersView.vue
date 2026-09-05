<script setup lang="ts">
import { computed, ref } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { z } from "zod";
import { toast } from "vue-sonner";
import { Pencil, Plus } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ApiError, type AdminUser, type Role } from "@/lib/api";
import { useCreateUser, useUpdateUser, useUsersQuery } from "@/composables/useUsers";

const ROLE_LABEL: Record<Role, string> = {
  tenaga_ahli: "Tenaga ahli",
  supervisi: "Supervisi",
  atasan: "Atasan",
  admin: "Admin",
};

const usersQuery = useUsersQuery();
const createUserMutation = useCreateUser();
const updateUserMutation = useUpdateUser();

const users = computed(() => usersQuery.data.value?.users ?? []);
const isSaving = computed(() => createUserMutation.isPending.value || updateUserMutation.isPending.value);

function namaUser(id: number | null): string {
  if (id === null) return "—";
  return users.value.find((u) => u.id === id)?.nama ?? "—";
}

const atasanOptions = computed(() =>
  users.value.filter((u) => u.roles.includes("atasan") && u.id !== editingId.value),
);
const supervisiOptions = computed(() =>
  users.value.filter((u) => u.roles.includes("supervisi") && u.id !== editingId.value),
);

const dialogOpen = ref(false);
const confirmOpen = ref(false);
const editingId = ref<number | null>(null);
const selectedRoles = ref<Role[]>([]);
const atasanId = ref<string>("none");
const supervisiId = ref<string>("none");
const rolesError = ref<string | null>(null);

interface PendingPayload {
  nama: string;
  email: string;
  password?: string;
  roles: Role[];
  atasanId: number | null;
  supervisiId: number | null;
}

const pendingPayload = ref<PendingPayload | null>(null);

const baseSchema = {
  nama: z.string().min(1, "Nama wajib diisi."),
  email: z.string().email("Email tidak valid."),
};

const formSchema = computed(() =>
  toTypedSchema(
    z.object({
      ...baseSchema,
      password:
        editingId.value === null
          ? z.string().min(8, "Password minimal 8 karakter.")
          : z.string().min(8, "Password minimal 8 karakter.").optional().or(z.literal("")),
    }),
  ),
);

const form = useForm({ validationSchema: formSchema });

function toggleRole(role: Role, checked: boolean) {
  selectedRoles.value = checked
    ? [...selectedRoles.value, role]
    : selectedRoles.value.filter((r) => r !== role);
}

function openCreate() {
  editingId.value = null;
  // resetForm() tanpa argumen balik ke initial values TERAKHIR yang di-set — kalau
  // sebelumnya openEdit() menyimpan data user sebagai initial values, form ini akan
  // muncul terisi lagi. Set eksplisit ke kosong.
  form.resetForm({ values: { nama: "", email: "", password: "" } });
  selectedRoles.value = [];
  atasanId.value = "none";
  supervisiId.value = "none";
  rolesError.value = null;
  dialogOpen.value = true;
}

function openEdit(user: AdminUser) {
  editingId.value = user.id;
  form.resetForm({ values: { nama: user.nama, email: user.email, password: "" } });
  selectedRoles.value = [...user.roles];
  atasanId.value = user.atasanId === null ? "none" : String(user.atasanId);
  supervisiId.value = user.supervisiId === null ? "none" : String(user.supervisiId);
  rolesError.value = null;
  dialogOpen.value = true;
}

const onSubmit = form.handleSubmit((values) => {
  if (selectedRoles.value.length === 0) {
    rolesError.value = "Pilih minimal satu peran.";
    return;
  }
  rolesError.value = null;

  pendingPayload.value = {
    nama: values.nama,
    email: values.email,
    password: values.password || undefined,
    roles: [...selectedRoles.value],
    atasanId: atasanId.value === "none" ? null : Number(atasanId.value),
    supervisiId: supervisiId.value === "none" ? null : Number(supervisiId.value),
  };
  confirmOpen.value = true;
});

async function confirmSave() {
  const payload = pendingPayload.value;
  if (!payload) return;

  try {
    if (editingId.value === null) {
      await createUserMutation.mutateAsync(payload);
      toast.success(`User "${payload.nama}" ditambahkan.`);
    } else {
      await updateUserMutation.mutateAsync({ id: editingId.value, payload });
      toast.success(`User "${payload.nama}" diperbarui.`);
    }
    pendingPayload.value = null;
    confirmOpen.value = false;
    dialogOpen.value = false;
  } catch (err) {
    confirmOpen.value = false;
    const message = err instanceof ApiError ? err.message : "Gagal menyimpan, coba lagi.";
    if (err instanceof ApiError && err.status === 409) {
      form.setFieldError("email", message);
    } else {
      toast.error(message);
    }
  }
}
</script>

<template>
  <div class="grid gap-4">
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-semibold">Kelola user</h1>
      <Dialog v-model:open="dialogOpen">
        <DialogTrigger as-child>
          <Button size="sm" @click="openCreate">
            <Plus class="mr-2 size-4" />
            Tambah user
          </Button>
        </DialogTrigger>
        <DialogContent class="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{{ editingId === null ? "Tambah user" : "Ubah user" }}</DialogTitle>
          </DialogHeader>

          <form class="grid gap-4" @submit="onSubmit" novalidate>
            <FormField v-slot="{ componentField }" name="nama">
              <FormItem>
                <FormLabel>Nama</FormLabel>
                <FormControl>
                  <Input v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField v-slot="{ componentField }" name="email">
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField v-slot="{ componentField }" name="password">
              <FormItem>
                <FormLabel>{{ editingId === null ? "Password" : "Reset password (opsional)" }}</FormLabel>
                <FormControl>
                  <Input type="password" autocomplete="new-password" v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <div class="grid gap-2">
              <Label>Peran</Label>
              <div class="grid gap-2">
                <label
                  v-for="role in (Object.keys(ROLE_LABEL) as Role[])"
                  :key="role"
                  class="flex items-center gap-2 text-sm"
                >
                  <Checkbox
                    :model-value="selectedRoles.includes(role)"
                    @update:model-value="(v) => toggleRole(role, v === true)"
                  />
                  {{ ROLE_LABEL[role] }}
                </label>
              </div>
              <p v-if="rolesError" class="text-sm text-destructive">{{ rolesError }}</p>
            </div>

            <div class="grid gap-2">
              <Label>Atasan</Label>
              <Select v-model="atasanId">
                <SelectTrigger class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tidak ada</SelectItem>
                  <SelectItem v-for="u in atasanOptions" :key="u.id" :value="String(u.id)">
                    {{ u.nama }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="grid gap-2">
              <Label>Supervisi</Label>
              <Select v-model="supervisiId">
                <SelectTrigger class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tidak ada</SelectItem>
                  <SelectItem v-for="u in supervisiOptions" :key="u.id" :value="String(u.id)">
                    {{ u.nama }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="submit" :disabled="isSaving">{{ isSaving ? "Menyimpan..." : "Simpan" }}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog v-model:open="confirmOpen">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {{ editingId === null ? "Tambah user ini?" : "Simpan perubahan user ini?" }}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {{ pendingPayload?.nama }} — {{ pendingPayload?.email }}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel :disabled="isSaving">Batal</AlertDialogCancel>
            <AlertDialogAction :disabled="isSaving" @click="confirmSave">
              {{ isSaving ? "Menyimpan..." : "Ya, simpan" }}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>

    <div class="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Peran</TableHead>
            <TableHead>Atasan</TableHead>
            <TableHead>Supervisi</TableHead>
            <TableHead class="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableEmpty v-if="usersQuery.isPending.value" :colspan="6">Memuat data user...</TableEmpty>
          <TableEmpty v-else-if="usersQuery.isError.value" :colspan="6">Gagal memuat data user.</TableEmpty>
          <TableEmpty v-else-if="users.length === 0" :colspan="6">Belum ada user.</TableEmpty>
          <TableRow v-for="user in users" :key="user.id">
            <TableCell class="font-medium">{{ user.nama }}</TableCell>
            <TableCell class="text-muted-foreground">{{ user.email }}</TableCell>
            <TableCell>
              <div class="flex flex-wrap gap-1">
                <Badge v-for="role in user.roles" :key="role" variant="secondary">
                  {{ ROLE_LABEL[role] }}
                </Badge>
              </div>
            </TableCell>
            <TableCell>{{ namaUser(user.atasanId) }}</TableCell>
            <TableCell>{{ namaUser(user.supervisiId) }}</TableCell>
            <TableCell class="text-right">
              <Button variant="ghost" size="icon" aria-label="Ubah user" @click="openEdit(user)">
                <Pencil class="size-4" />
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
