/**
 * Archive de bulletins condensés — stockée en local (localStorage).
 *
 * On n'archive PAS le HTML généré (figé), mais la portée (quels rapports
 * journaliers la composent). À chaque ouverture d'une entrée archivée, le
 * bulletin est régénéré à partir des données actuelles : si un rapport a été
 * corrigé depuis (stock, observations, etc.), le bulletin archivé reflète la
 * mise à jour.
 */

export interface CondensedBulletinArchiveEntry {
  id: string;
  campagneId: string;
  campagneNom: string;
  rapportIds: string[];
  label: string;
  archivedAt: string;
}

const ARCHIVE_KEY = "btl_bulletin_condense_archives";

export function loadCondensedBulletinArchives(): CondensedBulletinArchiveEntry[] {
  try {
    return JSON.parse(localStorage.getItem(ARCHIVE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveCondensedBulletinArchive(entry: CondensedBulletinArchiveEntry) {
  const list = loadCondensedBulletinArchives();
  list.unshift(entry);
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(list.slice(0, 200)));
}

export function deleteCondensedBulletinArchive(id: string) {
  localStorage.setItem(
    ARCHIVE_KEY,
    JSON.stringify(loadCondensedBulletinArchives().filter(a => a.id !== id))
  );
}

export function renameCondensedBulletinArchive(id: string, label: string) {
  const list = loadCondensedBulletinArchives().map(a => (a.id === id ? { ...a, label } : a));
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(list));
}
