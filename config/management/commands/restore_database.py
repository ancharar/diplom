"""Management-команда для восстановления БД и медиа из бэкапа."""

import os
import shutil
import subprocess
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    """Восстановление PostgreSQL, MongoDB и медиа из бэкапа."""

    help = 'Восстановление БД из бэкапа по timestamp'

    def add_arguments(self, parser):
        parser.add_argument(
            '--timestamp', required=True,
            help='Timestamp бэкапа (например, 2026-03-26_120000)',
        )
        parser.add_argument(
            '--backup-dir',
            default=os.getenv('BACKUP_DIR', './backups'),
            help='Директория бэкапов',
        )
        parser.add_argument(
            '--no-confirm', action='store_true',
            help='Пропустить подтверждение',
        )

    def handle(self, *args, **options):
        ts = options['timestamp']
        backup_dir = Path(options['backup_dir'])

        pg_file = backup_dir / f'pg_{ts}.sql'
        mongo_dir = backup_dir / f'mongo_{ts}'
        media_dir = backup_dir / f'media_{ts}'

        # Проверка существования
        exists = []
        if pg_file.exists():
            exists.append(f'PostgreSQL: {pg_file}')
        if mongo_dir.exists():
            exists.append(f'MongoDB: {mongo_dir}')
        if media_dir.exists():
            exists.append(f'Media: {media_dir}')

        if not exists:
            self.stderr.write(
                f'Бэкап с timestamp {ts} не найден '
                f'в {backup_dir}',
            )
            return

        self.stdout.write('Найдены бэкапы:')
        for item in exists:
            self.stdout.write(f'  {item}')

        if not options['no_confirm']:
            answer = input(
                'Все текущие данные будут заменены. '
                'Продолжить? [y/N] ',
            )
            if answer.lower() != 'y':
                self.stdout.write('Отменено.')
                return

        # --- PostgreSQL ---
        if pg_file.exists():
            self._restore_postgres(pg_file)

        # --- MongoDB ---
        if mongo_dir.exists():
            self._restore_mongo(mongo_dir)

        # --- Media ---
        if media_dir.exists():
            self._restore_media(media_dir)

        self.stdout.write(
            self.style.SUCCESS('Восстановление завершено!'),
        )

    def _restore_postgres(self, pg_file: Path):
        """Восстановление PostgreSQL из дампа."""
        db = settings.DATABASES['default']
        env = os.environ.copy()
        env['PGPASSWORD'] = db.get('PASSWORD', '')

        host = db.get('HOST', 'localhost')
        port = str(db.get('PORT', '5432'))
        user = db.get('USER', 'postgres')
        name = db.get('NAME', 'scientific_pm')

        cmd = [
            'psql',
            '-h', host, '-p', port,
            '-U', user, '-d', name,
            '-f', str(pg_file),
        ]

        try:
            subprocess.run(
                cmd, env=env, check=True,
                capture_output=True, text=True,
            )
            self.stdout.write(
                f'  PostgreSQL восстановлен из {pg_file}',
            )
        except (
            subprocess.CalledProcessError,
            FileNotFoundError,
        ) as e:
            self.stderr.write(
                f'  PostgreSQL ОШИБКА: {e}',
            )

    def _restore_mongo(self, mongo_dir: Path):
        """Восстановление MongoDB из дампа."""
        host = getattr(settings, 'MONGO_HOST', 'localhost')
        port = str(
            getattr(settings, 'MONGO_PORT', 27017),
        )

        cmd = [
            'mongorestore',
            '--host', host,
            '--port', port,
            '--drop',
            str(mongo_dir),
        ]

        try:
            subprocess.run(
                cmd, check=True,
                capture_output=True, text=True,
            )
            self.stdout.write(
                f'  MongoDB восстановлен из {mongo_dir}',
            )
        except (
            subprocess.CalledProcessError,
            FileNotFoundError,
        ) as e:
            self.stderr.write(
                f'  MongoDB ОШИБКА: {e}',
            )

    def _restore_media(self, media_dir: Path):
        """Восстановление MEDIA_ROOT из бэкапа."""
        media_root = Path(settings.MEDIA_ROOT)
        try:
            if media_root.exists():
                shutil.rmtree(media_root)
            shutil.copytree(media_dir, media_root)
            self.stdout.write(
                f'  Media восстановлен из {media_dir}',
            )
        except Exception as e:
            self.stderr.write(f'  Media ОШИБКА: {e}')
