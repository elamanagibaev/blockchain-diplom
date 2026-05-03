import React, { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";

type Student = {
  id: string;
  full_name: string | null;
  email: string;
  enrollment_year: number | null;
  major: string | null;
  created_at: string;
};

type CreateStudentResponse = {
  student: Student;
  generated_password: string;
};

export const DepartmentUsersPage: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [students, setStudents] = useState<Student[]>([]);
  const [fullName, setFullName] = useState("");
  const [enrollmentYear, setEnrollmentYear] = useState("");
  const [major, setMajor] = useState("");
  const [password, setPassword] = useState("");
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadStudents = async () => {
    const res = await api.get<Student[]>("/department/students");
    setStudents(res.data);
  };

  useEffect(() => {
    if (user?.role === "department") {
      void loadStudents();
    }
  }, [user?.role]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setGeneratedPassword(null);
    try {
      const res = await api.post<CreateStudentResponse>("/department/students", {
        full_name: fullName.trim(),
        enrollment_year: Number(enrollmentYear),
        major: major.trim(),
        password: password.trim() || undefined,
      });
      setGeneratedPassword(res.data.generated_password);
      setFullName("");
      setEnrollmentYear("");
      setMajor("");
      setPassword("");
      notify("success", "Студент создан");
      await loadStudents();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { detail?: string } } };
      notify("error", ax?.response?.data?.detail || "Не удалось создать студента");
    } finally {
      setLoading(false);
    }
  };

  if (user?.role !== "department") {
    return <div className="bad">Доступ только для кафедры</div>;
  }

  return (
    <div className="stack">
      <h1 className="page-title">Пользователи</h1>
      <form onSubmit={submit} className="stack card">
        <Input label="ФИО" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        <Input label="Год поступления" value={enrollmentYear} onChange={(e) => setEnrollmentYear(e.target.value)} required />
        <Input label="Специальность" value={major} onChange={(e) => setMajor(e.target.value)} required />
        <Input
          label="Пароль (оставьте пустым для автогенерации)"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" loading={loading}>Добавить студента</Button>
        {generatedPassword && <div className="good">Сгенерированный пароль (показывается один раз): <code>{generatedPassword}</code></div>}
      </form>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Список студентов</h2>
        <table className="data-table" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>ФИО</th>
              <th>Email</th>
              <th>Год</th>
              <th>Специальность</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td>{s.full_name || "—"}</td>
                <td>{s.email}</td>
                <td>{s.enrollment_year || "—"}</td>
                <td>{s.major || "—"}</td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={4}>Студентов пока нет</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
