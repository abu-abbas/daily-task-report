<script setup lang="ts">
import { computed, ref } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { z } from "zod";
import { toast } from "vue-sonner";
import { Pencil, Plus, Users, X } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { ApiError, type Project } from "@/lib/api";
import { useUsersQuery } from "@/composables/useUsers";
import {
  useAddProjectMember,
  useCreateProject,
  useEndProjectMembership,
  useProjectsQuery,
  useUpdateProject,
} from "@/composables/useProjects";

const projectsQuery = useProjectsQuery();
const usersQuery = useUsersQuery();
const createProjectMutation = useCreateProject();
const updateProjectMutation = useUpdateProject();
const addMemberMutation = useAddProjectMember();
const endMembershipMutation = useEndProjectMembership();

const projects = computed(() => projectsQuery.data.value?.projects ?? []);
const users = computed(() => usersQuery.data.value?.users ?? []);
const isSaving = computed(() => createProjectMutation.isPending.value || updateProjectMutation.isPending.value);

// --- Dialog tambah/ubah project ---
const dialogOpen = ref(false);
const confirmOpen = ref(false);
const editingId = ref<number | null>(null);
const isActive = ref(true);

interface PendingPayload {
  nama: string;
  isActive: boolean;
}
const pendingPayload = ref<PendingPayload | null>(null);

const formSchema = toTypedSchema(z.object({ nama: z.string().min(1, "Nama wajib diisi.") }));
const form = useForm({ validationSchema: formSchema });

function openCreate() {
  editingId.value = null;
  form.resetForm({ values: { nama: "" } });
  isActive.value = true;
  dialogOpen.value = true;
}

function openEdit(project: Project) {
  editingId.value = project.id;
  form.resetForm({ values: { nama: project.nama } });
  isActive.value = project.isActive;
  dialogOpen.value = true;
}

const onSubmit = form.handleSubmit((values) => {
  pendingPayload.value = { nama: values.nama, isActive: isActive.value };
  confirmOpen.value = true;
});

async function confirmSave() {
  const payload = pendingPayload.value;
  if (!payload) return;
  try {
    if (editingId.value === null) {
      await createProjectMutation.mutateAsync(payload);
      toast.success(`Project "${payload.nama}" ditambahkan.`);
    } else {
      await updateProjectMutation.mutateAsync({ id: editingId.value, payload });
      toast.success(`Project "${payload.nama}" diperbarui.`);
    }
    pendingPayload.value = null;
    confirmOpen.value = false;
    dialogOpen.value = false;
  } catch (err) {
    confirmOpen.value = false;
    toast.error(err instanceof ApiError ? err.message : "Gagal menyimpan, coba lagi.");
  }
}

// --- Dialog kelola anggota ---
const membersDialogOpen = ref(false);
const membersProjectId = ref<number | null>(null);
const selectedUserId = ref<string>("");

const membersProject = computed(() => projects.value.find((p) => p.id === membersProjectId.value) ?? null);
const nonMemberUsers = computed(() => {
  const memberIds = new Set(membersProject.value?.members.map((m) => m.id) ?? []);
  return users.value.filter((u) => !memberIds.has(u.id));
});

function openMembers(project: Project) {
  membersProjectId.value = project.id;
  selectedUserId.value = "";
  membersDialogOpen.value = true;
}

async function addMember() {
  if (!membersProjectId.value || !selectedUserId.value) return;
  try {
    await addMemberMutation.mutateAsync({ projectId: membersProjectId.value, userId: Number(selectedUserId.value) });
    toast.success("Anggota ditambahkan.");
    selectedUserId.value = "";
  } catch (err) {
    toast.error(err instanceof ApiError ? err.message : "Gagal menambah anggota.");
  }
}

async function removeMember(userId: number) {
  if (!membersProjectId.value) return;
  try {
    await endMembershipMutation.mutateAsync({ projectId: membersProjectId.value, userId });
    toast.success("Anggota dikeluarkan dari project.");
  } catch (err) {
    toast.error(err instanceof ApiError ? err.message : "Gagal mengeluarkan anggota.");
  }
}
</script>

<template>
  <div class="grid gap-4">
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-semibold">Kelola project</h1>
      <Dialog v-model:open="dialogOpen">
        <DialogTrigger as-child>
          <Button size="sm" @click="openCreate">
            <Plus class="mr-2 size-4" />
            Tambah project
          </Button>
        </DialogTrigger>
        <DialogContent class="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{{ editingId === null ? "Tambah project" : "Ubah project" }}</DialogTitle>
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

            <label class="flex items-center gap-2 text-sm">
              <Checkbox :model-value="isActive" @update:model-value="(v) => (isActive = v === true)" />
              Aktif
            </label>

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
              {{ editingId === null ? "Tambah project ini?" : "Simpan perubahan project ini?" }}
            </AlertDialogTitle>
            <AlertDialogDescription>{{ pendingPayload?.nama }}</AlertDialogDescription>
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
            <TableHead>Status</TableHead>
            <TableHead>Anggota</TableHead>
            <TableHead class="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableEmpty v-if="projectsQuery.isPending.value" :colspan="4">Memuat data project...</TableEmpty>
          <TableEmpty v-else-if="projectsQuery.isError.value" :colspan="4">Gagal memuat data project.</TableEmpty>
          <TableEmpty v-else-if="projects.length === 0" :colspan="4">Belum ada project.</TableEmpty>
          <TableRow v-for="project in projects" :key="project.id">
            <TableCell class="font-medium">{{ project.nama }}</TableCell>
            <TableCell>
              <Badge :variant="project.isActive ? 'default' : 'secondary'">
                {{ project.isActive ? "Aktif" : "Nonaktif" }}
              </Badge>
            </TableCell>
            <TableCell>
              <div v-if="project.members.length > 0" class="flex flex-wrap gap-1">
                <Badge v-for="m in project.members" :key="m.id" variant="outline">{{ m.nama }}</Badge>
              </div>
              <span v-else class="text-sm text-muted-foreground">Belum ada anggota</span>
            </TableCell>
            <TableCell class="text-right">
              <Button variant="ghost" size="icon" aria-label="Kelola anggota" @click="openMembers(project)">
                <Users class="size-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Ubah project" @click="openEdit(project)">
                <Pencil class="size-4" />
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <Dialog v-model:open="membersDialogOpen">
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Anggota — {{ membersProject?.nama }}</DialogTitle>
        </DialogHeader>

        <div class="grid gap-4">
          <ul class="grid gap-2">
            <li
              v-for="m in membersProject?.members ?? []"
              :key="m.id"
              class="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              {{ m.nama }}
              <Button
                variant="ghost"
                size="icon"
                class="size-6"
                :aria-label="`Keluarkan ${m.nama}`"
                :disabled="endMembershipMutation.isPending.value"
                @click="removeMember(m.id)"
              >
                <X class="size-3.5" />
              </Button>
            </li>
            <li v-if="(membersProject?.members ?? []).length === 0" class="text-sm text-muted-foreground">
              Belum ada anggota.
            </li>
          </ul>

          <div class="flex gap-2">
            <Select v-model="selectedUserId">
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Pilih user" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="u in nonMemberUsers" :key="u.id" :value="String(u.id)">
                  {{ u.nama }}
                </SelectItem>
              </SelectContent>
            </Select>
            <Button :disabled="!selectedUserId || addMemberMutation.isPending.value" @click="addMember">
              Tambah
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
