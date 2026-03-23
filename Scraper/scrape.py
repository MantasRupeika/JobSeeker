"""Scrape CVBankas job listings into JSON."""

from __future__ import annotations

import argparse
import json
import re
import time
from html.parser import HTMLParser
from pathlib import Path
from typing import Callable
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

BASE_URL = "https://www.cvbankas.lt/"
DEFAULT_OUTPUT = "cvbankas_jobs.json"
DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36"
    )
}


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


def main(argv: list[str] | None = None) -> int:
    """CLI entry point."""
    parser = argparse.ArgumentParser(description="Scrape CVBankas job listings into a JSON file.")
    parser.add_argument(
        "-c",
        "--count",
        type=int,
        help="How many job listings to scrape.",
    )
    parser.add_argument(
        "-o",
        "--output",
        default=DEFAULT_OUTPUT,
        help=f"Where to write the JSON output. Default: {DEFAULT_OUTPUT}",
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
    args = parser.parse_args(argv)

    count = args.count if args.count is not None else _prompt_for_count()
    jobs = scrape_jobs(count, start_url=args.start_url, delay_seconds=args.delay)
    output_path = export_jobs_to_json(jobs, args.output)

    print(f"Scraped {len(jobs)} job listings.")
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
