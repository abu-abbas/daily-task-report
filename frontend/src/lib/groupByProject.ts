export interface ProjectGroup<T> {
  projectId: number;
  projectNama: string;
  items: T[];
}

// Dipakai buat kartu "Kerjaan tambahan"/"Rencana" (InputHarianView, BerandaView) — badge project
// cuma tampil sekali per grup, bukan diulang per task, saat beberapa task ada di project sama.
export function groupByProject<T extends { projectId: number; projectNama: string }>(items: T[]): ProjectGroup<T>[] {
  const groups = new Map<number, ProjectGroup<T>>();
  for (const item of items) {
    let group = groups.get(item.projectId);
    if (!group) {
      group = { projectId: item.projectId, projectNama: item.projectNama, items: [] };
      groups.set(item.projectId, group);
    }
    group.items.push(item);
  }
  return [...groups.values()];
}
