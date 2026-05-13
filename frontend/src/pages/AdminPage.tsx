import React, { useEffect, useState } from "react";
import { notifyDashboardRefresh } from "../lib/dashboardRefresh";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { PageHeader } from "../components/PageHeader";
import { Spinner } from "../components/ui/Spinner";

type Health = {
  status: string;
  project?: string;
  version?: string;
  description?: string;
};

type University = {
  id: number;
  name: string;
  short_name?: string | null;
  registration_code: string;
};

type AdminUser = {
  id: string;
  email: string;
  full_name?: string | null;
  role: string;
  is_active: boolean;
  university_id?: number | null;
  university_name?: string | null;
  enrollment_year?: number | null;
  major?: string | null;
};

type PendingDoc = {
  id: string;
  file_name: string;
  sha256_hash: string;
  owner_email?: string | null;
  created_at: string;
};

type AdminGrade = {
  id: string;
  student_id: string;
  subject: string;
  course_year: number;
  grade: number | null;
  locked: boolean;
};

type AdminStudentGradesRow = {
  student: AdminUser;
  progress: {
    current_course: number;
    graduated: boolean;
  };
  grades: AdminGrade[];
  diploma_id?: string | null;
  integrity_status?: string | null;
};

type AdminTab = "overview" | "data-change" | "users" | "universities";

export const AdminPage: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [health, setHealth] = useState<Health | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [pendingDocs, setPendingDocs] = useState<PendingDoc[]>([]);
  const [studentsGrades, setStudentsGrades] = useState<AdminStudentGradesRow[]>([]);
  const [savingGradeId, setSavingGradeId] = useState<string | null>(null);
  const [selectedGradeByStudent, setSelectedGradeByStudent] = useState<Record<string, string>>({});
  const [newGradeByStudent, setNewGradeByStudent] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [newUniName, setNewUniName] = useState("");
  const [newUniShort, setNewUniShort] = useState("");
  const [newUniCode, setNewUniCode] = useState("");
  const [addingUni, setAddingUni] = useState(false);
  const [editingCodes, setEditingCodes] = useState<Record<number, string>>({});
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

  const loadPending = () => {
    api
      .get<PendingDoc[]>("/admin/documents/pending")
      .then((r) => setPendingDocs(r.data))
      .catch(() => setPendingDocs([]));
  };

  const loadStudentsGrades = () => {
    api
      .get<AdminStudentGradesRow[]>("/admin/students/grades")
      .then((r) => setStudentsGrades(r.data))
      .catch(() => setStudentsGrades([]));
  };

  useEffect(() => {
    setLoading(true);
    void Promise.all([
      api
        .get<Health>("/health")
        .then((r) => setHealth(r.data))
        .catch(() => setHealth({ status: "error" })),
      api
        .get<AdminUser[]>("/admin/users")
        .then((r) => setUsers(r.data))
        .catch(() => setUsers([])),
      api
        .get<University[]>("/admin/universities")
        .then((r) => setUniversities(r.data))
        .catch(() => setUniversities([])),
    ]).finally(() => setLoading(false));
    loadPending();
    loadStudentsGrades();
  }, []);

  const registerViaFilesApi = (id: string) => {
    setActionId(id);
    api
      .post(`/files/${id}/register`)
      .then(() => {
        loadPending();
        notifyDashboardRefresh();
        notify("success", "Документ зарегистрирован (POST /files/.../register).");
      })
      .catch((err: any) => {
        notify("error", err?.response?.data?.detail || "Ошибка регистрации");
      })
      .finally(() => setActionId(null));
  };

  const approveDoc = (id: string) => {
    setActionId(id);
    api
      .post(`/admin/documents/${id}/approve`)
      .then(() => {
        loadPending();
        notifyDashboardRefresh();
        notify("success", "Документ зарегистрирован в блокчейне.");
      })
      .catch((err: any) => {
        notify("error", err?.response?.data?.detail || "Ошибка регистрации");
      })
      .finally(() => setActionId(null));
  };

  const rejectDoc = (id: string) => {
    setActionId(id);
    api
      .post(`/admin/documents/${id}/reject`)
      .then(() => {
        loadPending();
        notify("success", "Заявка отклонена.");
      })
      .catch((err: any) => {
        notify("error", err?.response?.data?.detail || "Ошибка отклонения");
      })
      .finally(() => setActionId(null));
  };

  const updateRole = (id: string, role: string) => {
    api
      .patch(`/admin/users/${id}`, { role })
      .then(() => {
        setUsers((old) => old.map((u) => (u.id === id ? { ...u, role } : u)));
        notify("success", "Роль пользователя обновлена");
      })
      .catch((err: any) => {
        notify("error", err?.response?.data?.detail || "Ошибка обновления роли");
      });
  };

  const updateUniversity = (id: string, universityId: string) => {
    const university_id = universityId === "" ? null : Number(universityId);
    api
      .patch(`/admin/users/${id}`, { university_id })
      .then((r) => {
        const row = r.data as AdminUser;
        setUsers((old) =>
          old.map((u) =>
            u.id === id
              ? {
                  ...u,
                  university_id: row.university_id ?? null,
                  university_name: row.university_name ?? null,
                }
              : u
          )
        );
        notify("success", "Университет обновлён");
      })
      .catch((err: any) => {
        notify("error", err?.response?.data?.detail || "Ошибка обновления вуза");
      });
  };

  const addUniversity = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newUniName.trim();
    if (!name) {
      notify("error", "Введите название вуза");
      return;
    }
    const code = newUniCode.trim();
    if (!/^\d{5}$/.test(code)) {
      notify("error", "Код вуза должен состоять из 5 цифр");
      return;
    }
    setAddingUni(true);
    api
      .post<University>("/admin/universities", {
        name,
        short_name: newUniShort.trim() || null,
        registration_code: code,
      })
      .then((r) => {
        setUniversities((prev) => [...prev, r.data].sort((a, b) => a.id - b.id));
        setNewUniName("");
        setNewUniShort("");
        setNewUniCode("");
        notify("success", "Вуз добавлен");
      })
      .catch((err: any) => {
        notify("error", err?.response?.data?.detail || "Ошибка добавления вуза");
      })
      .finally(() => setAddingUni(false));
  };

  const saveUniCode = (id: number) => {
    const code = (editingCodes[id] || "").trim();
    if (!/^\d{5}$/.test(code)) {
      notify("error", "Код вуза должен состоять из 5 цифр");
      return;
    }
    api
      .patch<University>(`/admin/universities/${id}/code`, { registration_code: code })
      .then((r) => {
        setUniversities((prev) => prev.map((u) => (u.id === id ? r.data : u)));
        notify("success", "Код вуза обновлён");
      })
      .catch((err: any) => {
        notify("error", err?.response?.data?.detail || "Ошибка обновления кода");
      });
  };

  const deleteUser = (id: string) => {
    api
      .delete(`/admin/users/${id}`)
      .then(() => {
        setUsers((old) => old.filter((u) => u.id !== id));
        notify("success", "Пользователь удалён");
      })
      .catch((err: any) => {
        notify("error", err?.response?.data?.detail || "Ошибка удаления");
      });
  };

  const adminDemoSetGrade = (studentId: string, grade: AdminGrade | undefined, value: string) => {
    if (!grade) {
      notify("error", "Выберите дисциплину");
      return;
    }
    const num = Number(value);
    if (!Number.isInteger(num) || num < 0 || num > 100) {
      notify("error", "Оценка должна быть целым числом от 0 до 100");
      return;
    }
    if (num === grade.grade) return;
    setSavingGradeId(grade.id);
    api
      .post(`/admin/students/${studentId}/grades/${grade.id}/demo-data-change`, { grade: num })
      .then((r) => {
        loadStudentsGrades();
        notifyDashboardRefresh();
        notify(
          r.data?.integrity_status === "MISMATCH" ? "warning" : "success",
          r.data?.integrity_status === "MISMATCH"
            ? "Цепочка доверия нарушена: изменение зафиксировано в блокчейне"
            : "Оценка изменена"
        );
      })
      .catch((err: any) => {
        notify("error", err?.response?.data?.detail || "Не удалось изменить оценку");
      })
      .finally(() => setSavingGradeId(null));
  };

  if (user?.role !== "admin") {
    return (
      <div className="page admin-page">
        <PageHeader title="Админ-панель" />
        <div className="card">
          <div className="bad">
            Требуется роль Администратор для доступа к административным функциям.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page admin-page">
      <PageHeader
        title="Админ-панель"
        subtitle="Финальная on-chain регистрация, пользователи и справочник вузов (согласование: кафедра → деканат)"
      />

      <div className="tabs" style={{ marginBottom: 16 }}>
        {[
          ["overview", "Обзор"],
          ["data-change", "Изменение данных"],
          ["users", "Пользователи"],
          ["universities", "Университеты"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`tab ${activeTab === key ? "tab--active" : ""}`}
            onClick={() => setActiveTab(key as AdminTab)}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <>
      <div className="grid" style={{ gridTemplateColumns: "minmax(0,2.2fr) minmax(0,3fr)", gap: 16 }}>
        <div className="card card--subtle">
          <div className="label">Общее состояние</div>
          {loading && !health ? (
            <div className="text-center" style={{ padding: "12px 0" }}>
              <Spinner size={28} />
            </div>
          ) : (
            <div style={{ marginTop: 8 }}>
              <div>
                <span className="muted">Статус:</span> <code>{health?.status ?? "—"}</code>
              </div>
              {health?.project && (
                <div style={{ marginTop: 4 }}>
                  <span className="muted">Проект:</span> {health.project}
                </div>
              )}
              {health?.version && (
                <div style={{ marginTop: 2 }}>
                  <span className="muted">Версия:</span> {health.version}
                </div>
              )}
              {health?.description && (
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  {health.description}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card card--subtle">
          <div className="label">Политика доступа</div>
          <div className="muted" style={{ fontSize: 13, lineHeight: 1.45 }}>
            Кафедра загружает документ и подаёт его на согласование, подтверждает этап кафедры; деканат согласует второй
            этап; администратор выполняет только финальную запись в блокчейн и управление учётными записями (не участвует
            в согласовании).
          </div>
        </div>
      </div>

      <section className="admin-zone admin-zone--final">
        <div className="admin-zone__head">
          <h2 className="admin-zone__title">Очередь APPROVED → on-chain</h2>
          <p className="admin-zone__sub">
            Документы со статусом <code>APPROVED</code> после подтверждения деканатом. Кнопка записывает хэш и метаданные
            в смарт-контракт.
          </p>
        </div>
        <div className="admin-zone__body">
          {pendingDocs.length === 0 ? (
            <div className="muted" style={{ padding: "8px 0" }}>
              Нет документов, ожидающих on-chain регистрации.
            </div>
          ) : (
            <div className="ui-table-wrap table-scroll">
              <table className="w-full" style={{ width: "100%", minWidth: 900 }}>
                <thead>
                  <tr>
                    <th>Документ</th>
                    <th>Владелец</th>
                    <th>Дата</th>
                    <th>Финальная регистрация</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingDocs.map((d) => (
                    <tr key={d.id}>
                      <td>{d.file_name}</td>
                      <td>{d.owner_email || "—"}</td>
                      <td>{new Date(d.created_at).toLocaleString()}</td>
                      <td>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => approveDoc(d.id)}
                            disabled={actionId === d.id}
                          >
                            {actionId === d.id ? "…" : "Зарегистрировать в сети"}
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-muted"
                            title="Альтернативный маршрут pipeline"
                            onClick={() => registerViaFilesApi(d.id)}
                            disabled={actionId === d.id}
                          >
                            /files/register
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => rejectDoc(d.id)}
                            disabled={actionId === d.id}
                          >
                            Отказать
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
        </>
      )}

      {activeTab === "data-change" && (
      <section className="admin-zone admin-zone--users">
        <div className="admin-zone__head">
          <h2 className="admin-zone__title">Проверка изменения данных</h2>
          <p className="admin-zone__sub">
            Администратор видит студентов всех вузов и может имитировать изменение оценки после регистрации диплома.
          </p>
        </div>
        <div className="admin-zone__body">
          <div className="ui-table-wrap table-scroll">
            <table className="w-full" style={{ width: "100%", minWidth: 1180 }}>
              <thead>
                <tr>
                  <th style={{ width: "22%" }}>Email</th>
                  <th>Вуз</th>
                  <th style={{ width: "28%" }}>Дисциплина</th>
                  <th>Текущая</th>
                  <th>Новая</th>
                  <th>Статус</th>
                  <th>Действие</th>
                </tr>
              </thead>
              <tbody>
                {studentsGrades.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="muted">
                      Студенты не найдены
                    </td>
                  </tr>
                ) : (
                  studentsGrades.map((row) => {
                    const editable = Boolean(row.diploma_id) && row.integrity_status !== "NOT_REGISTERED";
                    const availableGrades = row.grades.filter((g) => g.grade !== null);
                    const selectedGradeId = selectedGradeByStudent[row.student.id] || availableGrades[0]?.id || "";
                    const selectedGrade = availableGrades.find((g) => g.id === selectedGradeId);
                    const value = newGradeByStudent[row.student.id] ?? String(selectedGrade?.grade ?? "");
                    return (
                      <tr key={row.student.id}>
                        <td>{row.student.email}</td>
                        <td>{row.student.university_name || "—"}</td>
                        <td>
                          <select
                            className="input"
                            value={selectedGradeId}
                            disabled={!editable}
                            onChange={(e) => {
                              const gradeId = e.target.value;
                              const grade = availableGrades.find((g) => g.id === gradeId);
                              setSelectedGradeByStudent((prev) => ({ ...prev, [row.student.id]: gradeId }));
                              setNewGradeByStudent((prev) => ({ ...prev, [row.student.id]: String(grade?.grade ?? "") }));
                            }}
                            style={{ width: "100%", minWidth: 280 }}
                          >
                            {availableGrades.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.course_year} курс · {g.subject}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>{selectedGrade?.grade ?? "—"}</td>
                        <td>
                          <input
                            className="input"
                            type="number"
                            min={0}
                            max={100}
                            value={value}
                            disabled={!editable || savingGradeId === selectedGradeId}
                            onChange={(e) => setNewGradeByStudent((prev) => ({ ...prev, [row.student.id]: e.target.value }))}
                            style={{ width: 90 }}
                          />
                        </td>
                        <td>
                          {row.integrity_status === "MISMATCH" ? (
                            <span className="bad">Данные изменены</span>
                          ) : row.integrity_status === "NOT_REGISTERED" ? (
                            <span className="muted">Диплом не зарегистрирован</span>
                          ) : (
                            <span className="ok">Без изменений</span>
                          )}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            disabled={!editable || !selectedGrade || savingGradeId === selectedGradeId}
                            onClick={() => adminDemoSetGrade(row.student.id, selectedGrade, value)}
                          >
                            {savingGradeId === selectedGradeId ? "…" : "Применить"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      )}

      {activeTab === "users" && (
      <section className="admin-zone admin-zone--users">
        <div className="admin-zone__head">
          <h2 className="admin-zone__title">Пользователи</h2>
          <p className="admin-zone__sub">Все пользователи платформы, включая студентов всех вузов.</p>
        </div>
        <div className="admin-zone__body">
          {loading ? (
            <div className="text-center" style={{ padding: "12px 0" }}>
              <Spinner size={28} />
            </div>
          ) : (
            <div className="ui-table-wrap table-scroll">
              <table className="w-full" style={{ width: "100%", minWidth: 980 }}>
                <thead>
                  <tr>
                    <th style={{ width: "28%" }}>Email</th>
                    <th style={{ width: "16%" }}>Роль</th>
                    <th style={{ width: "28%" }}>Университет</th>
                    <th style={{ width: "18%" }}>Обучение</th>
                    <th style={{ width: "10%" }}>Действие</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="muted">
                        Пользователей пока нет
                      </td>
                    </tr>
                  ) : users.map((u) => {
                        const isProtectedAdmin = u.role === "admin";
                        return (
                        <tr key={u.id}>
                          <td>{u.email}</td>
                          <td>
                            <select
                              value={u.role}
                              onChange={(e) => updateRole(u.id, e.target.value)}
                              disabled={isProtectedAdmin}
                              className="input"
                              style={{ maxWidth: 160, fontSize: 13, padding: "6px 8px" }}
                            >
                              <option value="student">Студент</option>
                              <option value="department">Кафедра</option>
                              <option value="dean">Деканат</option>
                              <option value="registrar">Регистратор</option>
                              <option value="admin">Администратор</option>
                            </select>
                          </td>
                          <td>
                            <select
                              className="input"
                              style={{ maxWidth: 220, fontSize: 13, padding: "6px 8px" }}
                              value={u.university_id != null && u.university_id !== undefined ? String(u.university_id) : ""}
                              onChange={(e) => updateUniversity(u.id, e.target.value)}
                              disabled={isProtectedAdmin}
                            >
                              <option value="">—</option>
                              {universities.map((uni) => (
                                <option key={uni.id} value={uni.id}>
                                  {uni.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <div>{u.major || "—"}</div>
                            <div className="muted" style={{ fontSize: 12 }}>{u.enrollment_year ? `${u.enrollment_year} год` : "Год не указан"}</div>
                          </td>
                          <td>
                            <button type="button" className="btn btn-sm btn-danger" onClick={() => deleteUser(u.id)} disabled={isProtectedAdmin}>
                              {isProtectedAdmin ? "Защищён" : "Удалить"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
      )}

      {activeTab === "universities" && (
      <section className="admin-zone admin-zone--users" style={{ marginTop: 24 }}>
        <div className="admin-zone__head">
          <h2 className="admin-zone__title">Университеты</h2>
          <p className="admin-zone__sub">Справочник вузов для привязки пользователей.</p>
        </div>
        <div className="admin-zone__body">
          <div className="ui-table-wrap table-scroll">
            <table className="w-full" style={{ width: "100%", minWidth: 900 }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Название</th>
                  <th>Код регистрации</th>
                  <th>Короткое название</th>
                </tr>
              </thead>
              <tbody>
                {universities.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted">
                      Нет записей
                    </td>
                  </tr>
                ) : (
                  universities.map((uni) => (
                    <tr key={uni.id}>
                      <td>{uni.id}</td>
                      <td>{uni.name}</td>
                      <td>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input
                            className="input"
                            style={{ width: 90 }}
                            maxLength={5}
                            value={editingCodes[uni.id] ?? uni.registration_code}
                            onChange={(e) =>
                              setEditingCodes((prev) => ({ ...prev, [uni.id]: e.target.value.replace(/\D/g, "").slice(0, 5) }))
                            }
                            placeholder="12345"
                          />
                          <button type="button" className="btn btn-sm btn-muted" onClick={() => saveUniCode(uni.id)}>
                            Сохранить
                          </button>
                        </div>
                      </td>
                      <td>{uni.short_name || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <form onSubmit={addUniversity} className="card card--subtle" style={{ marginTop: 16 }}>
            <div className="label">Добавить вуз</div>
            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 200px" }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                  Название
                </div>
                <input
                  className="input"
                  value={newUniName}
                  onChange={(e) => setNewUniName(e.target.value)}
                  placeholder="Полное название"
                />
              </div>
              <div style={{ flex: "1 1 180px" }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                  Короткое название (необязательно)
                </div>
                <input
                  className="input"
                  value={newUniShort}
                  onChange={(e) => setNewUniShort(e.target.value)}
                  placeholder="Кратко"
                />
              </div>
              <div style={{ flex: "0 1 140px" }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                  Код (5 цифр)
                </div>
                <input
                  className="input"
                  value={newUniCode}
                  onChange={(e) => setNewUniCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
                  placeholder="12345"
                />
              </div>
              <button type="submit" className="btn btn-primary btn-sm" disabled={addingUni}>
                {addingUni ? "…" : "Добавить вуз"}
              </button>
            </div>
          </form>
        </div>
      </section>
      )}
    </div>
  );
};
