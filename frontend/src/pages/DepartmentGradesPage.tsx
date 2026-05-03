import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { Button } from "../components/ui/Button";

type Grade = {
  id: string;
  student_id: string;
  subject: string;
  course_year: number;
  grade: number | null;
  locked: boolean;
};

type StudentGradesRow = {
  student: {
    id: string;
    full_name: string | null;
    enrollment_year: number | null;
  };
  progress: {
    current_course: number;
    graduated: boolean;
  };
  grades: Grade[];
};

const COURSE_ORDER = [1, 2, 3, 4];

export const DepartmentGradesPage: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [rows, setRows] = useState<StudentGradesRow[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    const res = await api.get<StudentGradesRow[]>("/department/students/grades");
    setRows(res.data);
  };

  useEffect(() => {
    if (user?.role === "department") void load();
  }, [user?.role]);

  const allSubjects = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const row of rows) {
      for (const g of row.grades) {
        const arr = map.get(g.course_year) || [];
        if (!arr.includes(g.subject)) arr.push(g.subject);
        map.set(g.course_year, arr);
      }
    }
    for (const [, subjects] of map) subjects.sort();
    return map;
  }, [rows]);

  const setGrade = async (studentId: string, grade: Grade, value: string) => {
    const num = Number(value);
    if (Number.isNaN(num)) return;
    if (num < 0 || num > 100) {
      notify("error", "Оценка должна быть от 0 до 100");
      return;
    }
    setSavingId(grade.id);
    try {
      await api.put(`/department/students/${studentId}/grades/${grade.id}`, { grade: num });
      await load();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { detail?: string } } };
      notify("error", ax?.response?.data?.detail || "Не удалось сохранить оценку");
    } finally {
      setSavingId(null);
    }
  };

  const promote = async (studentId: string) => {
    try {
      await api.post(`/department/students/${studentId}/promote`);
      notify("success", "Студент переведен");
      await load();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { detail?: string } } };
      notify("error", ax?.response?.data?.detail || "Не удалось перевести студента");
    }
  };

  const graduate = async (studentId: string) => {
    try {
      await api.post(`/department/students/${studentId}/graduate`);
      notify("success", "Диплом выдан и отправлен в workflow");
      await load();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { detail?: string } } };
      notify("error", ax?.response?.data?.detail || "Не удалось выдать диплом");
    }
  };

  if (user?.role !== "department") return <div className="bad">Доступ только для кафедры</div>;

  return (
    <div className="stack">
      <h1 className="page-title">Оценки</h1>
      <div style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 8 }}>
        Максимум можно поставить 100%
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="data-table" style={{ width: "100%", minWidth: 1400 }}>
          <thead>
            <tr>
              <th>Студент</th>
              {COURSE_ORDER.flatMap((course) =>
                (allSubjects.get(course) || []).map((subject) => <th key={`${course}-${subject}`}>{course} курс: {subject}</th>)
              )}
              <th>Действие</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const byKey = new Map(row.grades.map((g) => [`${g.course_year}:${g.subject}`, g]));
              const nowYear = new Date().getFullYear();
              const canPromoteByYear = nowYear > ((row.student.enrollment_year || nowYear) + row.progress.current_course - 1);
              const currentCourseGrades = row.grades.filter((g) => g.course_year === row.progress.current_course);
              const canPromoteByGrades = currentCourseGrades.every((g) => g.grade !== null);
              const canPromote = row.progress.current_course < 4 && canPromoteByYear && canPromoteByGrades;
              const fourthCourseReady = row.grades.filter((g) => g.course_year === 4).every((g) => g.grade !== null);
              const canGraduate = row.progress.current_course === 4 && !row.progress.graduated && fourthCourseReady;

              return (
                <tr key={row.student.id}>
                  <td>{row.student.full_name || "—"}</td>
                  {COURSE_ORDER.flatMap((course) =>
                    (allSubjects.get(course) || []).map((subject) => {
                      const g = byKey.get(`${course}:${subject}`);
                      if (!g) return <td key={`${row.student.id}-${course}-${subject}`}>—</td>;
                      const isCurrent = course === row.progress.current_course;
                      const isFuture = course > row.progress.current_course;
                      const locked = g.locked || !isCurrent || isFuture;
                      return (
                        <td key={g.id} style={{ background: locked ? "var(--bg-secondary)" : "transparent" }}>
                          {locked ? (
                            <span>{g.grade ?? "—"}</span>
                          ) : (
                            <input
                              type="number"
                              min={0}
                              max={100}
                              title="Оценка от 0 до 100"
                              defaultValue={g.grade ?? ""}
                              onBlur={(e) => void setGrade(row.student.id, g, e.target.value)}
                              disabled={savingId === g.id}
                              style={{ width: 90 }}
                            />
                          )}
                        </td>
                      );
                    })
                  )}
                  <td>
                    {row.progress.graduated ? (
                      "Выпускник"
                    ) : row.progress.current_course < 4 ? (
                      <Button size="sm" onClick={() => void promote(row.student.id)} disabled={!canPromote}>
                        Перевести на следующий курс
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => void graduate(row.student.id)} disabled={!canGraduate}>
                        Выдать диплом
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
