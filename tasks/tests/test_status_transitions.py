"""Тесты конечного автомата переходов статуса задачи."""

import pytest


# Допустимые переходы → 200
@pytest.mark.parametrize('from_s,to_s', [
    ('todo', 'in_progress'),
    ('in_progress', 'done'),
    ('in_progress', 'todo'),
])
def test_valid_transition(auth_client, task_in_project, from_s, to_s):
    task_in_project.status = from_s
    task_in_project.save()
    resp = auth_client.patch(
        f'/api/v1/tasks/{task_in_project.id}/status/',
        {'status': to_s},
        format='json',
    )
    assert resp.status_code == 200
    assert resp.data['status'] == to_s


# Недопустимые переходы → 400 с русским текстом ошибки
@pytest.mark.parametrize('from_s,to_s', [
    ('todo', 'done'),
    ('done', 'todo'),
    ('done', 'in_progress'),
])
def test_invalid_transition(auth_client, task_in_project, from_s, to_s):
    task_in_project.status = from_s
    task_in_project.save()
    resp = auth_client.patch(
        f'/api/v1/tasks/{task_in_project.id}/status/',
        {'status': to_s},
        format='json',
    )
    assert resp.status_code == 400
    assert 'error' in resp.data
    # Ошибка должна быть на русском
    assert 'недопустим' in resp.data['error'].lower()


# Не участник проекта → 403
def test_status_change_not_member(outsider_client, task_in_project):
    resp = outsider_client.patch(
        f'/api/v1/tasks/{task_in_project.id}/status/',
        {'status': 'in_progress'},
        format='json',
    )
    assert resp.status_code == 403
