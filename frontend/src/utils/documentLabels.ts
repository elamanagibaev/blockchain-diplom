export type DocumentLabelSource = {
  file_name?: string | null;
  title?: string | null;
  description?: string | null;
};

const LEGACY_GENERATED_DIPLOMA = "Автоматически сгенерированный диплом";

function clean(value: string | null | undefined): string {
  return value?.trim() || "";
}

export function isLegacyGeneratedDiplomaLabel(value: string | null | undefined): boolean {
  return clean(value).toLowerCase().startsWith(LEGACY_GENERATED_DIPLOMA.toLowerCase());
}

export function documentListLabel(doc: DocumentLabelSource): string {
  const title = clean(doc.title);
  if (title && !isLegacyGeneratedDiplomaLabel(title)) return title;

  const description = clean(doc.description);
  if (description && !isLegacyGeneratedDiplomaLabel(description)) return description;

  return clean(doc.file_name) || "Документ";
}

export function documentDetailLabel(doc: DocumentLabelSource): string {
  return documentListLabel(doc);
}
