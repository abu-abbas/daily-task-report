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

// Data contoh sementara — diganti pemanggilan API sungguhan saat backend Stage 2 siap.
type Role = "tenaga_ahli" | "supervisi" | "atasan" | "admin";

interface AdminUser {
  id: number;
  nama: string;
  email: string;
  roles: Role[];
  atasanId: number | null;
  supervisiId: number | null;
}

const ROLE_LABEL: Record<Role, string> = {
  tenaga_ahli: "Tenaga ahli",
  supervisi: "Supervisi",
  atasan: "Atasan",
  admin: "Admin",
};

const users = ref<AdminUser[]>([
  { id: 1, nama: "Rudi Hartono", email: "rudi.hartono@kantor.test", roles: ["admin", "tenaga_ahli"], atasanId: null, supervisiId: null },
  { id: 2, nama: "Siti Aminah", email: "siti.aminah@kantor.test", roles: ["atasan"], atasanId: null, supervisiId: null },
  { id: 3, nama: "Budi Santoso", email: "budi.santoso@kantor.test", roles: ["supervisi", "tenaga_ahli"], atasanId: 2, supervisiId: null },
  { id: 4, nama: "Dewi Lestari", email: "dewi.lestari@kantor.test", roles: ["supervisi"], atasanId: 2, supervisiId: null },
  { id: 5, nama: "Agus Prasetyo", email: "agus.prasetyo@kantor.test", roles: ["tenaga_ahli"], atasanId: null, supervisiId: 3 },
  { id: 6, nama: "Maya Puspita", email: "maya.puspita@kantor.test", roles: ["tenaga_ahli"], atasanId: null, supervisiId: 4 },
]);

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
  form.resetForm();
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
    roles: [...selectedRoles.value],
    atasanId: atasanId.value === "none" ? null : Number(atasanId.value),
    supervisiId: supervisiId.value === "none" ? null : Number(supervisiId.value),
  };
  confirmOpen.value = true;
});

function confirmSave() {
  const payload = pendingPayload.value;
  if (!payload) return;

  if (editingId.value === null) {
    const nextId = Math.max(0, ...users.value.map((u) => u.id)) + 1;
    users.value.push({ id: nextId, ...payload });
    toast.success(`User "${payload.nama}" ditambahkan.`);
  } else {
    const target = users.value.find((u) => u.id === editingId.value);
    if (target) Object.assign(target, payload);
    toast.success(`User "${payload.nama}" diperbarui.`);
  }

  pendingPayload.value = null;
  dialogOpen.value = false;
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
              <Button type="submit">Simpan</Button>
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
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction @click="confirmSave">Ya, simpan</AlertDialogAction>
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
          <TableEmpty v-if="users.length === 0" :colspan="6">Belum ada user.</TableEmpty>
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
