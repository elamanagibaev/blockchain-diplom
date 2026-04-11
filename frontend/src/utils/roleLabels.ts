export const ROLE_LABELS: Record<string, string> = {
  admin: "Администратор",
  department: "Кафедра",
  dean: "Деканат",
  user: "Студент",
  registrar: "Регистратор",
};

export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}
