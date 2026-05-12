import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { getErrorMessage } from '../utils/errorMessages';
import styles from '../styles/CreateProject.module.scss';

interface MemberInput {
  user_id: string;
  role: string;
}

export default function CreateProjectPage() {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const [form, setForm] = useState({
    title: '',
    area: '',
    description: '',
    goal: '',
    start_date: '',
    end_date: '',
  });

  const [members, setMembers] = useState<MemberInput[]>([{ user_id: '', role: 'developer' }]);
  const [loading, setLoading] = useState(false);

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleMemberChange = (index: number, field: keyof MemberInput, value: string) => {
    const updated = [...members];
    updated[index][field] = value;
    setMembers(updated);
  };

  const addMemberField = () => {
    setMembers([...members, { user_id: '', role: 'developer' }]);
  };

  const removeMemberField = (index: number) => {
    if (members.length > 1) {
      setMembers(members.filter((_, i) => i !== index));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validMembers = members
        .filter((m) => m.user_id.trim() !== '')
        .map((m) => ({
          user_id: Number(m.user_id),
          project_role: m.role,
        }));

      const payload = {
        ...form,
        members: validMembers,
      };

      const { data } = await client.post('/projects/', payload);
      showSuccess('Проект создан');
      navigate(`/projects/${data.id}`);
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>

      <form className={styles.form} onSubmit={handleCreate}>
        {/* Основная информация */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Основная информация</h2>

          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label className={styles.label}>
                Название проекта <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                className={styles.input}
                placeholder="Например: Разработка рекомендательной системы"
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>
                Область исследования <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                className={styles.input}
                placeholder="Машинное обучение, Биоинформатика"
                value={form.area}
                onChange={(e) => update('area', e.target.value)}
                required
              />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label className={styles.label}>
                Дата начала <span className={styles.required}>*</span>
              </label>
              <input
                type="date"
                className={styles.input}
                value={form.start_date}
                onChange={(e) => update('start_date', e.target.value)}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>
                Дата окончания <span className={styles.required}>*</span>
              </label>
              <input
                type="date"
                className={styles.input}
                value={form.end_date}
                onChange={(e) => update('end_date', e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        {/* Дополнительная информация */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Дополнительная информация</h2>

          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Описание проекта</label>
              <textarea
                className={styles.textarea}
                placeholder="Краткое описание целей и задач проекта..."
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                rows={4}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Цель проекта</label>
              <textarea
                className={styles.textarea}
                placeholder="Какая основная цель проекта?"
                value={form.goal}
                onChange={(e) => update('goal', e.target.value)}
                rows={4}
              />
            </div>
          </div>
        </div>

        {/* Участники (необязательно) */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Участники проекта</h2>
            <span className={styles.optionalBadge}>Необязательно</span>
          </div>
          <p className={styles.hint}>
            Вы можете добавить участников сейчас или пригласить их позже
          </p>

          <div className={styles.membersList}>
            {members.map((member, index) => (
              <div key={index} className={styles.memberRow}>
                <div className={styles.memberField}>
                  <label className={styles.labelSmall}>ID пользователя</label>
                  <input
                    type="number"
                    className={styles.inputSmall}
                    placeholder="Введите ID"
                    value={member.user_id}
                    onChange={(e) => handleMemberChange(index, 'user_id', e.target.value)}
                  />
                </div>
                <div className={styles.memberField}>
                  <label className={styles.labelSmall}>Роль в проекте</label>
                  <select
                    className={styles.selectSmall}
                    value={member.role}
                    onChange={(e) => handleMemberChange(index, 'role', e.target.value)}
                  >
                    <option value="analyst">Аналитик</option>
                    <option value="developer">Разработчик</option>
                    <option value="tester">Тестировщик</option>
                    <option value="designer">Дизайнер</option>
                    <option value="researcher">Исследователь</option>
                  </select>
                </div>
                {members.length > 1 && (
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => removeMemberField(index)}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            className={styles.addMemberBtn}
            onClick={addMemberField}
          >
            + Добавить участника
          </button>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => navigate('/projects')}
          >
            Отмена
          </button>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading}
          >
            {loading ? 'Создание...' : 'Создать проект'}
          </button>
        </div>
      </form>
    </div>
  );
}