import React, { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload } from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
export const UploadPage: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useNotification();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [graduateName, setGraduateName] = useState("");
  const [year, setYear] = useState("");
  const [major, setMajor] = useState("");
  const [diplomaNumber, setDiplomaNumber] = useState("");
  const [studentWallet, setStudentWallet] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [drag, setDrag] = useState(false);

  const isValidWallet = (w: string): boolean => {
    const s = w.trim();
    return /^0x[a-fA-F0-9]{40}$/.test(s);
  };

  const buildDescription = (): string => {
    const t = title.trim();
    const meta: string[] = [];
    if (graduateName.trim()) meta.push(`Выпускник: ${graduateName.trim()}`);
    if (year.trim()) meta.push(`Год выпуска: ${year.trim()}`);
    if (major.trim()) meta.push(`Специальность: ${major.trim()}`);
    if (diplomaNumber.trim()) meta.push(`№ диплома: ${diplomaNumber.trim()}`);
    if (meta.length) return `${meta.join("\n")}\n\n${t}`;
    return t;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError("Выберите файл");
      return;
    }
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Введите название документа");
      return;
    }
    const sw = studentWallet.trim();
    if (!isValidWallet(sw)) {
      setError("Укажите корректный student_wallet: 0x и 40 hex-символов");
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      form.append("upload_file", file);
      form.append("description", buildDescription());
      form.append("student_wallet", sw);
      const res = await api.post<{ id: string }>("/files/upload", form);
      notify("success", "Документ загружен, хэш зафиксирован.");
      navigate(`/files/${res.data.id}`);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { detail?: string } } };
      const msg = ax?.response?.data?.detail || "Ошибка загрузки";
      setError(typeof msg === "string" ? msg : "Ошибка загрузки");
      notify("error", typeof msg === "string" ? msg : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  }, []);

  const formatSize = (bytes: number) => {
    if (!bytes && bytes !== 0) return "";
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  };

  if (user && user.role !== "department") {
    return (
      <div>
        <h1 className="page-title">Загрузка диплома</h1>
        <Card padding="lg">
          <p className="bad" style={{ margin: 0 }}>
            Загрузка документов доступна только учётной записи с ролью <code>department</code> (кафедра). Войдите под
            соответствующей учётной записью.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Загрузка диплома</h1>
      <p className="page-subtitle">
        PDF, DOC, DOCX, изображение или текст. Укажите название — оно попадёт в реестр. Дополнительные поля объединяются в
        описание (один запрос к API, как раньше). Доступно только роли кафедры.
      </p>

      <div className="row" style={{ alignItems: "stretch", gap: 24, flexWrap: "wrap" }}>
        <Card className="stack" padding="lg" style={{ flex: "2 1 400px" }}>
          <form onSubmit={submit} className="stack">
            <div
              className={`drop-zone ${drag ? "drop-zone--active" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={onDrop}
              onClick={() => document.getElementById("upload-input")?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") document.getElementById("upload-input")?.click();
              }}
            >
              <Upload
                size={36}
                strokeWidth={1.5}
                style={{ margin: "0 auto 12px", color: "var(--accent)", opacity: 0.9 }}
              />
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Перетащите файл сюда</div>
              <div className="muted" style={{ fontSize: 13 }}>
                или нажмите, чтобы выбрать
              </div>
              <input
                id="upload-input"
                type="file"
                accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*,text/*,.pdf,.doc,.docx"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>

            {file && (
              <div style={{ fontSize: 13, padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
                <strong>{file.name}</strong>
                <span className="muted" style={{ marginLeft: 8 }}>
                  {formatSize(file.size)}
                </span>
              </div>
            )}

            <Input
              label="Student wallet выпускника (обязательно)"
              name="student_wallet"
              value={studentWallet}
              onChange={(e) => setStudentWallet(e.target.value)}
              placeholder="0x…"
              required
            />
            <p className="muted" style={{ fontSize: 12, marginTop: -4 }}>
              Ethereum-адрес для записи в реестр и QR после согласования деканата (автоматически).
            </p>
            <Input label="Название документа (обязательно)" name="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: Диплом бакалавра" required />
            <Input label="ФИО выпускника" name="graduate" value={graduateName} onChange={(e) => setGraduateName(e.target.value)} placeholder="Необязательно" />
            <div className="row" style={{ gap: 16 }}>
              <div style={{ flex: 1, minWidth: 120 }}>
                <Input label="Год выпуска" name="year" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2024" />
              </div>
              <div style={{ flex: 2, minWidth: 160 }}>
                <Input label="Специальность" name="major" value={major} onChange={(e) => setMajor(e.target.value)} />
              </div>
            </div>
            <Input label="Номер диплома" name="diploma" value={diplomaNumber} onChange={(e) => setDiplomaNumber(e.target.value)} />

            {error && <div className="bad">{error}</div>}

            <Button type="submit" variant="primary" size="lg" loading={loading} disabled={loading}>
              Загрузить и зафиксировать хэш
            </Button>
          </form>
        </Card>

        <Card style={{ flex: "1 1 280px" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Как это работает</h2>
          <ol style={{ paddingLeft: 18, color: "var(--text-muted)", fontSize: 14, lineHeight: 1.55 }}>
            <li style={{ marginBottom: 10 }}>Файл сохраняется в хранилище, в БД — хэш SHA-256 и метаданные.</li>
            <li style={{ marginBottom: 10 }}>После согласования деканата регистрация в сети и привязка к кошельку выполняются автоматически.</li>
            <li>Проверка подлинности — по хэшу содержимого на странице верификации.</li>
          </ol>
        </Card>
      </div>

    </div>
  );
};
