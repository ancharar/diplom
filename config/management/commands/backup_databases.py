"""Management-команда для резервного копирования БД и медиа."""

import os
import shutil
import subprocess
from datetime import datetime, timedelta
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    """Резервное копирование PostgreSQL, MongoDB и медиа."""

    help = (
        'Создание бэкапов PostgreSQL, MongoDB и '
        'медиа-файлов'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--backup-dir',
            default=os.getenv('BACKUP_DIR', './backups'),
            help='Директория для бэкапов',
        )

    def handle(self, *args, **options):
        backup_dir = Path(options['backup_dir'])
        backup_dir.mkdir(parents=True, exist_ok=True)

        ts = datetime.now().strftime('%Y-%m-%d_%H%M%S')
        self.stdout.write(f'Начало бэкапа: {ts}')

        # --- PostgreSQL ---
        pg_file = backup_dir / f'pg_{ts}.sql'
        self._backup_postgres(pg_file)

        # --- MongoDB ---
        mongo_dir = backup_dir / f'mongo_{ts}'
        self._backup_mongo(mongo_dir)

        # --- Media ---
        media_dir = backup_dir / f'media_{ts}'
        self._backup_media(media_dir)

        # --- Ротация ---
        self._cleanup_old(backup_dir)

        self.stdout.write(
            self.style.SUCCESS('Бэкап завершён успешно!'),
        )

    def _backup_postgres(self, output_path: Path):
        """pg_dump для PostgreSQL."""
        db = settings.DATABASES['default']
        env = os.environ.copy()
        env['PGPASSWORD'] = db.get('PASSWORD', '')

        cmd = [
            'pg_dump',
            '-h', db.get('HOST', 'localhost'),
            '-p', str(db.get('PORT', '5432')),
            '-U', db.get('USER', 'postgres'),
            '-d', db.get('NAME', 'scientific_pm'),
            '-f', str(output_path),
        ]

        try:
            subprocess.run(
                cmd, env=env, check=True,
                capture_output=True, text=True,
            )
            size = output_path.stat().st_size
            self.stdout.write(
                f'  PostgreSQL: {output_path} '
                f'({size} байт)',
            )
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            self.stderr.write(
                f'  PostgreSQL ОШИБКА: {e}',
            )

    def _backup_mongo(self, output_dir: Path):
        """mongodump для MongoDB."""
        host = getattr(settings, 'MONGO_HOST', 'localhost')
        port = str(getattr(settings, 'MONGO_PORT', 27017))
        db_name = getattr(
            settings, 'MONGO_DB_NAME', 'scientific_pm_docs',
        )

        cmd = [
            'mongodump',
            '--host', host,
            '--port', port,
            '--db', db_name,
            '--out', str(output_dir),
        ]

        try:
            subprocess.run(
                cmd, check=True,
                capture_output=True, text=True,
            )
            self.stdout.write(
                f'  MongoDB: {output_dir}',
            )
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            self.stderr.write(
                f'  MongoDB ОШИБКА: {e}',
            )

    def _backup_media(self, output_dir: Path):
        """Копирование MEDIA_ROOT."""
        media_root = Path(settings.MEDIA_ROOT)
        if not media_root.exists():
            self.stdout.write('  Media: папка не найдена, пропуск')
            return

        try:
            shutil.copytree(media_root, output_dir)
            self.stdout.write(
                f'  Media: {output_dir}',
            )
        except Exception as e:
            self.stderr.write(f'  Media ОШИБКА: {e}')

    def _cleanup_old(self, backup_dir: Path):
        """Удаление бэкапов старше BACKUP_RETENTION_DAYS."""
        days = int(
            os.getenv('BACKUP_RETENTION_DAYS', '30'),
        )
        cutoff = datetime.now() - timedelta(days=days)

        removed = 0
        for item in backup_dir.iterdir():
            if item.stat().st_mtime < cutoff.timestamp():
                if item.is_dir():
                    shutil.rmtree(item)
                else:
                    item.unlink()
                removed += 1

        if removed:
            self.stdout.write(
                f'  Удалено старых бэкапов: {removed}',
            )
