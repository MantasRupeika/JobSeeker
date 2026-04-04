"""Scrape CVBankas job listings into the JobSeeker SQLite database."""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
import time
from html.parser import HTMLParser
from pathlib import Path
from typing import Callable
from urllib.error import HTTPError, URLError
from urllib.parse import quote_plus, urljoin, urlparse
from urllib.request import Request, urlopen

BASE_URL = "https://www.cvbankas.lt/"
DEFAULT_DB_PATH = Path(__file__).resolve().parents[1] / "backend" / "data" / "jobfinder.db"
DEFAULT_GEOCODING_COUNTRY = "Lithuania"
DEFAULT_GEOCODING_DELAY = 1.0
DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36"
    )
}
JOBS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    company TEXT,
    salary_min REAL,
    salary_max REAL,
    job_type TEXT,
    address TEXT,
    lat REAL,
    lng REAL,
    url TEXT UNIQUE,
    scraped_at TEXT DEFAULT (datetime('now'))
)
"""


def fetch_html(url: str, timeout: int = 30) -> str:
    """Fetch a page and return decoded HTML."""
    request = Request(url, headers=DEFAULT_HEADERS)
    try:
        with urlopen(request, timeout=timeout) as response:
            raw_body = response.read()
            charset = response.headers.get_content_charset() or "utf-8"
    except HTTPError as exc:
        raise RuntimeError(f"HTTP error {exc.code} while fetching {url}") from exc
    except URLError as exc:
        raise RuntimeError(f"Could not fetch {url}: {exc.reason}") from exc

    try:
        return raw_body.decode(charset)
    except UnicodeDecodeError:
        return raw_body.decode("utf-8", errors="replace")


def extract_job_links(listing_html: str, base_url: str = BASE_URL) -> list[str]:
    """Extract unique job links from a listing page."""
    parser = _ListingPageParser(base_url)
    parser.feed(listing_html)
    return parser.links


def extract_next_page_url(listing_html: str, base_url: str = BASE_URL) -> str | None:
    """Extract the next listing page URL, if present."""
    parser = _ListingPageParser(base_url)
    parser.feed(listing_html)
    return parser.next_page_url


def parse_job_listing(job_html: str, source_url: str) -> dict[str, str]:
    """Parse a CVBankas job detail page into the requested fields."""
    parser = _JobListingParser()
    parser.feed(job_html)

    title = _clean_text("".join(parser.title))
    description = _normalize_description(parser.description_parts)
    if not title:
        raise ValueError(f"Could not find title in {source_url}")
    if not description:
        raise ValueError(f"Could not find description in {source_url}")

    return {
        "title": title,
        "salary": _clean_text("".join(parser.salary)),
        "description": description,
        "location": _clean_text("".join(parser.location)),
        "url": source_url,
    }


def scrape_jobs(
    count: int,
    *,
    start_url: str = BASE_URL,
    fetcher: Callable[[str], str] | None = None,
    delay_seconds: float = 0.0,
) -> list[dict[str, str]]:
    """Scrape up to ``count`` jobs by traversing listing pages and job pages."""
    if count <= 0:
        raise ValueError("count must be greater than 0")

    active_fetcher = fetcher or fetch_html
    jobs: list[dict[str, str]] = []
    seen_job_urls: set[str] = set()
    seen_page_urls: set[str] = set()
    page_url: str | None = start_url

    while page_url and len(jobs) < count:
        if page_url in seen_page_urls:
            break
        seen_page_urls.add(page_url)

        listing_html = active_fetcher(page_url)
        for job_url in extract_job_links(listing_html, base_url=start_url):
            if job_url in seen_job_urls:
                continue
            seen_job_urls.add(job_url)

            job_html = active_fetcher(job_url)
            jobs.append(parse_job_listing(job_html, job_url))

            if len(jobs) >= count:
                break
            if delay_seconds > 0:
                time.sleep(delay_seconds)

        if len(jobs) >= count:
            break

        page_url = extract_next_page_url(listing_html, base_url=start_url)
        if page_url and delay_seconds > 0:
            time.sleep(delay_seconds)

    return jobs


def export_jobs_to_json(jobs: list[dict[str, str]], output_path: str | Path) -> Path:
    """Write scraped jobs to a JSON file."""
    output_file = Path(output_path)
    output_file.write_text(
        json.dumps(jobs, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return output_file


def parse_salary_range(salary_text: str) -> tuple[float | None, float | None]:
    """Extract salary bounds from scraped salary text."""
    normalized = salary_text.replace("\xa0", " ")
    matches = re.findall(r"\d+(?:[.,]\d+)?", normalized)
    values = [float(match.replace(",", ".")) for match in matches]

    if not values:
        return None, None
    if len(values) == 1:
        return values[0], values[0]
    return values[0], values[1]


def geocode_address(
    address: str,
    *,
    country: str = DEFAULT_GEOCODING_COUNTRY,
    timeout: int = 30,
    fetcher: Callable[[str, int], str] | None = None,
) -> tuple[float, float] | None:
    """Resolve an address into latitude/longitude using OpenStreetMap Nominatim."""
    normalized_address = _clean_text(address)
    if not normalized_address:
        return None

    query = normalized_address if not country else f"{normalized_address}, {country}"
    geocoding_url = (
        "https://nominatim.openstreetmap.org/search"
        f"?format=jsonv2&limit=1&q={quote_plus(query)}"
    )

    active_fetcher = fetcher or _fetch_geocoding_response
    raw_payload = active_fetcher(geocoding_url, timeout)

    try:
        results = json.loads(raw_payload)
    except json.JSONDecodeError as exc:
        raise RuntimeError("Failed to decode geocoding response.") from exc

    if not isinstance(results, list) or not results:
        return None

    first_result = results[0]
    try:
        lat = float(first_result["lat"])
        lng = float(first_result["lon"])
    except (KeyError, TypeError, ValueError):
        return None

    return lat, lng


def get_db_connection(db_path: str | Path = DEFAULT_DB_PATH) -> sqlite3.Connection:
    """Open the shared JobSeeker SQLite database and ensure the jobs table exists."""
    resolved_path = Path(db_path)
    resolved_path.parent.mkdir(parents=True, exist_ok=True)

    connection = sqlite3.connect(resolved_path)
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute(JOBS_TABLE_SQL)
    return connection


def insert_jobs_into_db(
    jobs: list[dict[str, str]],
    db_path: str | Path = DEFAULT_DB_PATH,
    *,
    geocoder: Callable[[str], tuple[float, float] | None] | None = None,
    geocoding_delay_seconds: float = DEFAULT_GEOCODING_DELAY,
) -> int:
    """Insert or update scraped jobs in the shared SQLite database."""
    connection = get_db_connection(db_path)
    inserted_count = 0
    geocode_cache: dict[str, tuple[float, float] | None] = {}
    active_geocoder = geocoder or geocode_address

    try:
        for job in jobs:
            salary_min, salary_max = parse_salary_range(job.get("salary", ""))
            lat, lng = _resolve_job_coordinates(
                job.get("location", ""),
                geocoder=active_geocoder,
                cache=geocode_cache,
                geocoding_delay_seconds=geocoding_delay_seconds,
                should_delay=geocoder is None,
            )
            connection.execute(
                """
                INSERT INTO jobs (
                    title,
                    company,
                    salary_min,
                    salary_max,
                    job_type,
                    address,
                    lat,
                    lng,
                    url,
                    scraped_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                ON CONFLICT(url) DO UPDATE SET
                    title = excluded.title,
                    salary_min = excluded.salary_min,
                    salary_max = excluded.salary_max,
                    address = excluded.address,
                    lat = excluded.lat,
                    lng = excluded.lng,
                    scraped_at = datetime('now')
                """,
                (
                    job["title"],
                    None,
                    salary_min,
                    salary_max,
                    None,
                    job.get("location") or None,
                    lat,
                    lng,
                    job["url"],
                ),
            )
            inserted_count += 1

        connection.commit()
    finally:
        connection.close()

    return inserted_count


def main(argv: list[str] | None = None) -> int:
    """CLI entry point."""
    parser = argparse.ArgumentParser(description="Scrape CVBankas job listings into the JobSeeker SQLite database.")
    parser.add_argument(
        "-c",
        "--count",
        type=int,
        help="How many job listings to scrape.",
    )
    parser.add_argument(
        "--db-path",
        default=str(DEFAULT_DB_PATH),
        help=f"SQLite database path. Default: {DEFAULT_DB_PATH}",
    )
    parser.add_argument(
        "--json-output",
        help="Optional JSON output path if you also want to save the scraped payload to a file.",
    )
    parser.add_argument(
        "--start-url",
        default=BASE_URL,
        help=f"Listing page to start from. Default: {BASE_URL}",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.5,
        help="Delay in seconds between requests. Default: 0.5",
    )
    parser.add_argument(
        "--geocoding-delay",
        type=float,
        default=DEFAULT_GEOCODING_DELAY,
        help=f"Delay in seconds between external geocoding requests. Default: {DEFAULT_GEOCODING_DELAY}",
    )
    args = parser.parse_args(argv)

    count = args.count if args.count is not None else _prompt_for_count()
    jobs = scrape_jobs(count, start_url=args.start_url, delay_seconds=args.delay)
    written_count = insert_jobs_into_db(
        jobs,
        args.db_path,
        geocoding_delay_seconds=args.geocoding_delay,
    )

    print(f"Scraped {len(jobs)} job listings.")
    print(f"Inserted or updated {written_count} job listings in {Path(args.db_path).resolve()}")

    if args.json_output:
        output_path = export_jobs_to_json(jobs, args.json_output)
        print(f"Saved JSON to {output_path.resolve()}")
    return 0


def _prompt_for_count() -> int:
    while True:
        raw_value = input("How many job listings should be scraped? ").strip()
        try:
            count = int(raw_value)
        except ValueError:
            print("Enter a whole number greater than 0.")
            continue
        if count <= 0:
            print("Enter a whole number greater than 0.")
            continue
        return count


def _is_job_link(url: str) -> bool:
    parsed = urlparse(url)
    if parsed.netloc not in {"cvbankas.lt", "www.cvbankas.lt"}:
        return False
    return bool(re.search(r"/1-\d+$", parsed.path))


def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _clean_multiline_text(value: str) -> str:
    lines = [_clean_text(line) for line in value.splitlines()]
    return "\n".join(line for line in lines if line)


def _normalize_description(parts: list[str]) -> str:
    text = "".join(parts)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return _clean_multiline_text(text)


def _has_class(attrs: dict[str, str], class_name: str) -> bool:
    return class_name in attrs.get("class", "").split()


def _fetch_geocoding_response(url: str, timeout: int) -> str:
    request = Request(
        url,
        headers={
            **DEFAULT_HEADERS,
            "Accept": "application/json",
        },
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            charset = response.headers.get_content_charset() or "utf-8"
            return response.read().decode(charset)
    except HTTPError as exc:
        raise RuntimeError(f"HTTP error {exc.code} while geocoding {url}") from exc
    except URLError as exc:
        raise RuntimeError(f"Could not geocode {url}: {exc.reason}") from exc


def _resolve_job_coordinates(
    location: str,
    *,
    geocoder: Callable[[str], tuple[float, float] | None],
    cache: dict[str, tuple[float, float] | None],
    geocoding_delay_seconds: float,
    should_delay: bool,
) -> tuple[float | None, float | None]:
    normalized_location = _clean_text(location)
    if not normalized_location:
        return None, None

    cache_key = normalized_location.lower()
    if cache_key in cache:
        cached = cache[cache_key]
        if cached is None:
            return None, None
        return cached

    try:
        coordinates = geocoder(normalized_location)
    except Exception:
        coordinates = None
    cache[cache_key] = coordinates

    if should_delay and geocoding_delay_seconds > 0:
        time.sleep(geocoding_delay_seconds)

    if coordinates is None:
        return None, None

    return coordinates


class _ListingPageParser(HTMLParser):
    def __init__(self, base_url: str) -> None:
        super().__init__(convert_charrefs=True)
        self.base_url = base_url
        self.links: list[str] = []
        self.next_page_url: str | None = None
        self._seen: set[str] = set()

    def handle_starttag(self, tag: str, attrs) -> None:
        attr_map = dict(attrs)
        href = attr_map.get("href")
        rel_values = set((attr_map.get("rel") or "").split())

        if tag == "a" and href:
            full_url = urljoin(self.base_url, href)
            if _is_job_link(full_url) and full_url not in self._seen:
                self._seen.add(full_url)
                self.links.append(full_url)
            if "next" in rel_values and self.next_page_url is None:
                self.next_page_url = full_url

        if tag == "link" and href and "next" in rel_values and self.next_page_url is None:
            self.next_page_url = urljoin(self.base_url, href)


class _JobListingParser(HTMLParser):
    _description_break_tags = {"br", "div", "section", "li", "ul", "ol", "p", "h1", "h2", "h3", "h4"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title: list[str] = []
        self.salary: list[str] = []
        self.location: list[str] = []
        self.description_parts: list[str] = []

        self._in_title = False
        self._title_depth = 0
        self._salary_component_depth = 0
        self._in_salary_label = False
        self._salary_label_depth = 0
        self._in_location_link = False
        self._location_depth = 0
        self._in_description = False
        self._description_depth = 0

    def handle_starttag(self, tag: str, attrs) -> None:
        attr_map = dict(attrs)

        if attr_map.get("itemprop") == "title":
            self._in_title = True
            self._title_depth = 1
        elif self._in_title:
            self._title_depth += 1

        if _has_class(attr_map, "salary_component") and not self.salary:
            self._salary_component_depth = 1
        elif self._salary_component_depth > 0:
            self._salary_component_depth += 1

        if self._salary_component_depth > 0 and _has_class(attr_map, "label_component_body") and not self._in_salary_label:
            self._in_salary_label = True
            self._salary_label_depth = 1
        elif self._in_salary_label:
            self._salary_label_depth += 1

        href = attr_map.get("href", "")
        if tag == "a" and "maps.google.com" in href:
            self._in_location_link = True
            self._location_depth = 1
        elif self._in_location_link:
            self._location_depth += 1

        if attr_map.get("itemprop") == "description":
            self._in_description = True
            self._description_depth = 1
            self._append_description_break(double=True)
        elif self._in_description:
            self._description_depth += 1

        if self._in_description and tag in self._description_break_tags:
            self._append_description_break(double=(tag == "section"))

    def handle_endtag(self, tag: str) -> None:
        if self._in_title:
            self._title_depth -= 1
            if self._title_depth <= 0:
                self._in_title = False

        if self._in_salary_label:
            self._salary_label_depth -= 1
            if self._salary_label_depth <= 0:
                self._in_salary_label = False

        if self._salary_component_depth > 0:
            self._salary_component_depth -= 1

        if self._in_location_link:
            self._location_depth -= 1
            if self._location_depth <= 0:
                self._in_location_link = False

        if self._in_description and tag in self._description_break_tags:
            self._append_description_break(double=(tag == "section"))

        if self._in_description:
            self._description_depth -= 1
            if self._description_depth <= 0:
                self._in_description = False

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title.append(data)
        if self._in_salary_label:
            self.salary.append(data)
        if self._in_location_link:
            self.location.append(data)
        if self._in_description:
            self.description_parts.append(data)

    def _append_description_break(self, *, double: bool = False) -> None:
        if not self.description_parts:
            return
        marker = "\n\n" if double else "\n"
        if self.description_parts[-1] != marker:
            self.description_parts.append(marker)
 

if __name__ == "__main__":
    raise SystemExit(main())
