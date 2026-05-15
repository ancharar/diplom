"""Сервисный слой для извлечения метаданных публикаций."""

import re
import xml.etree.ElementTree as ET

import requests as http_requests
from bs4 import BeautifulSoup


def _extract_doi_from_url(url: str) -> str | None:
    """Извлечь DOI из URL."""
    # doi.org URL
    m = re.search(r'doi\.org/(10\.\d{4,9}/[^\s&?#]+)', url)
    if m:
        return m.group(1)
    # DOI в произвольном URL-параметре или пути
    m = re.search(r'(10\.\d{4,9}/[^\s&?#]+)', url)
    if m:
        return m.group(1)
    return None


def _extract_arxiv_id(url: str) -> str | None:
    """Извлечь arXiv ID из URL."""
    m = re.search(r'arxiv\.org/abs/(\d+\.\d+)', url)
    if m:
        return m.group(1)
    m = re.search(r'arxiv\.org/pdf/(\d+\.\d+)', url)
    if m:
        return m.group(1)
    return None


def fetch_crossref(doi: str) -> dict:
    """Получить метаданные через CrossRef API."""
    url = f'https://api.crossref.org/works/{doi}'
    resp = http_requests.get(url, timeout=(2, 4), headers={
        'User-Agent': 'ScienceFlow/1.0',
    })
    resp.raise_for_status()
    item = resp.json().get('message', {})

    authors = []
    for a in item.get('author', []):
        parts = []
        if a.get('family'):
            parts.append(a['family'])
        if a.get('given'):
            parts.append(a['given'])
        if parts:
            authors.append(' '.join(parts))

    title_parts = item.get('title', [])
    title = title_parts[0] if title_parts else ''

    journal_parts = item.get('container-title', [])
    journal = journal_parts[0] if journal_parts else ''

    year = None
    date_parts = item.get('published', {}).get('date-parts', [[]])
    if date_parts and date_parts[0]:
        year = date_parts[0][0]

    return {
        'title': title,
        'authors': authors,
        'year': year,
        'journal': journal,
        'volume': item.get('volume', ''),
        'issue': item.get('issue', ''),
        'pages': item.get('page', ''),
        'doi': doi,
        'url': item.get('URL', ''),
        'extraction_confidence': 'high',
    }


ARXIV_API_URL = 'http://export.arxiv.org/api/query'
ATOM_NS = '{http://www.w3.org/2005/Atom}'


def fetch_arxiv(arxiv_id: str) -> dict:
    """Получить метаданные через arXiv API."""
    params = {
        'id_list': arxiv_id,
        'max_results': 1,
    }
    resp = http_requests.get(ARXIV_API_URL, params=params, timeout=(2, 4))
    resp.raise_for_status()

    root = ET.fromstring(resp.text)
    entry = root.find(f'{ATOM_NS}entry')
    if entry is None:
        return {'extraction_confidence': 'low'}

    authors = [
        a.findtext(f'{ATOM_NS}name', '')
        for a in entry.findall(f'{ATOM_NS}author')
    ]

    published = entry.findtext(f'{ATOM_NS}published', '')
    year = int(published[:4]) if len(published) >= 4 else None

    title = entry.findtext(
        f'{ATOM_NS}title', '',
    ).strip().replace('\n', ' ')

    return {
        'title': title,
        'authors': authors,
        'year': year,
        'journal': 'arXiv',
        'volume': '',
        'issue': '',
        'pages': '',
        'doi': '',
        'url': f'https://arxiv.org/abs/{arxiv_id}',
        'extraction_confidence': 'high',
    }


def fetch_html_meta(url: str) -> dict:
    """Извлечь метаданные из HTML-мета-тегов."""
    try:
        resp = http_requests.get(
            url, timeout=(2, 4),
            headers={'User-Agent': 'ScienceFlow/1.0'},
            allow_redirects=True,
        )
        resp.raise_for_status()
    except Exception:
        return {'extraction_confidence': 'low'}

    soup = BeautifulSoup(resp.text, 'html.parser')

    def meta(name: str) -> str:
        tag = soup.find('meta', attrs={'name': name})
        if tag:
            return tag.get('content', '')
        tag = soup.find('meta', attrs={'property': name})
        if tag:
            return tag.get('content', '')
        return ''

    title = (
        meta('citation_title')
        or meta('og:title')
        or meta('dc.title')
        or (soup.title.string if soup.title else '')
        or ''
    )

    # Authors
    author_tags = soup.find_all(
        'meta', attrs={'name': 'citation_author'},
    )
    if not author_tags:
        author_tags = soup.find_all(
            'meta', attrs={'name': 'dc.creator'},
        )
    authors = [t.get('content', '') for t in author_tags]

    date_str = (
        meta('citation_publication_date')
        or meta('citation_date')
        or meta('dc.date')
    )
    year = None
    if date_str:
        m = re.search(r'(\d{4})', date_str)
        if m:
            year = int(m.group(1))

    journal = (
        meta('citation_journal_title')
        or meta('citation_publisher')
        or ''
    )
    volume = meta('citation_volume')
    issue = meta('citation_issue')
    pages_first = meta('citation_firstpage')
    pages_last = meta('citation_lastpage')
    pages = ''
    if pages_first:
        pages = pages_first
        if pages_last:
            pages += f'-{pages_last}'

    doi_meta = meta('citation_doi') or meta('dc.identifier')
    doi = ''
    if doi_meta:
        m = re.search(r'(10\.\d{4,9}/[^\s]+)', doi_meta)
        if m:
            doi = m.group(1)

    confidence = 'low'
    if title and authors:
        confidence = 'medium'

    return {
        'title': title.strip(),
        'authors': authors,
        'year': year,
        'journal': journal.strip(),
        'volume': volume,
        'issue': issue,
        'pages': pages,
        'doi': doi,
        'url': url,
        'extraction_confidence': confidence,
    }


def extract_metadata(url: str) -> dict:
    """Основная функция: попробовать извлечь метаданные из URL."""
    result = {
        'title': '',
        'authors': [],
        'year': None,
        'journal': '',
        'volume': '',
        'issue': '',
        'pages': '',
        'doi': '',
        'url': url,
        'raw_url': url,
        'extraction_confidence': 'low',
    }

    # 1. Проверяем DOI
    doi = _extract_doi_from_url(url)
    if doi:
        try:
            data = fetch_crossref(doi)
            data['raw_url'] = url
            if not data.get('url'):
                data['url'] = url
            return data
        except Exception:
            pass

    # 2. Проверяем arXiv
    arxiv_id = _extract_arxiv_id(url)
    if arxiv_id:
        try:
            data = fetch_arxiv(arxiv_id)
            data['raw_url'] = url
            return data
        except Exception:
            pass

    # 3. HTML-парсинг
    try:
        data = fetch_html_meta(url)
        data['raw_url'] = url
        return data
    except Exception:
        pass

    return result
