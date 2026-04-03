import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

import scrape


LISTING_HTML = """
<html>
  <head>
    <link rel="next" href="https://www.cvbankas.lt/?page=2" />
  </head>
  <body>
    <a href="https://www.cvbankas.lt/pardaveja-as-konsultante-as-pc-mega-pilnu-etatu-kaune/1-13712947">
      First job
    </a>
    <a href="https://www.cvbankas.lt/statybos-darbu-vadovas-moletuose/1-9544584">
      Second job
    </a>
    <a href="https://www.cvbankas.lt/pardavimu-vadybininkas-vilniuje/1-13494419?foo=bar">
      Third job
    </a>
    <a href="https://www.cvbankas.lt/pardavimu-vadybininkas-vilniuje/1-13494419?foo=bar">
      Duplicate third job
    </a>
  </body>
</html>
"""


DETAIL_HTML = """
<article itemscope="itemscope" itemtype="http://schema.org/JobPosting" lang="en" id="jobad_c">
  <div id="jobad_content_main">
    <header id="jobad_header" class="js_id_jobad_header">
      <h1 class="heading1" id="jobad_heading1" itemprop="title">Operations Manager</h1>
      <div class="group_component ad_info_group">
        <div class="salary_component">
          <span class="data_tag_component">
            <span class="data_tag_component_container">
              <div class="data_tag_component_body salary_bl_gross">
                <div class="label_component">
                  <div class="label_component_icon ico_euro_sign"></div>
                  <div class="label_component_body">
                    <span class="data_tag_component_salary_amount">3400-4400</span> \u20ac/mon.
                    neatskai\u010dius mokes\u010di\u0173
                  </div>
                </div>
              </div>
              <div class="salary_calculate_bl salary_calculate_bl__full_length js_salary_calculate_a">
                <span class="salary_calculate_text">CVbankas.lt skai\u010diuokl\u0117s duomenys.</span>
                <span class="button_action">Redaguoti \u00bb</span>
              </div>
            </span>
          </span>
        </div>
      </div>
    </header>
    <section itemprop="description">
      <section>
        <div class="jobad_txt">
          Great Cyber products are not created by accident.<br />
          <br />
          We're looking for an experienced and ambitious person.
        </div>
      </section>
      <section>
        <h2 class="heading2 jobad_subheading">What You Will Do</h2>
        <div class="jobad_txt">
          <ul>
            <li>Lead the team.</li>
            <li>Oversee day-to-day operations.</li>
          </ul>
        </div>
      </section>
      <section>
        <h2 class="heading2 jobad_subheading">What We Expect From You</h2>
        <div class="jobad_txt">
          <ul>
            <li>Leadership experience.</li>
          </ul>
        </div>
      </section>
    </section>
    <div id="company_info">
      <a href="https://maps.google.com/?q=%C5%A0vitrigailos%20g.%2034,%20LT-03230%20Vilnius">
        \u0160vitrigailos g. 34, LT-03230 Vilnius
      </a>
    </div>
  </div>
</article>
"""


SECOND_PAGE_HTML = """
<html>
  <body>
    <a href="https://www.cvbankas.lt/fourth-job-vilniuje/1-44444444">Fourth job</a>
    <a href="https://www.cvbankas.lt/fifth-job-vilniuje/1-55555555">Fifth job</a>
  </body>
</html>
"""


class ExtractJobLinksTests(unittest.TestCase):
    def test_extract_job_links_deduplicates_and_preserves_order(self):
        links = scrape.extract_job_links(LISTING_HTML)

        self.assertEqual(
            links,
            [
                "https://www.cvbankas.lt/pardaveja-as-konsultante-as-pc-mega-pilnu-etatu-kaune/1-13712947",
                "https://www.cvbankas.lt/statybos-darbu-vadovas-moletuose/1-9544584",
                "https://www.cvbankas.lt/pardavimu-vadybininkas-vilniuje/1-13494419?foo=bar",
            ],
        )

    def test_extract_next_page_url(self):
        self.assertEqual(
            scrape.extract_next_page_url(LISTING_HTML),
            "https://www.cvbankas.lt/?page=2",
        )


class ParseJobListingTests(unittest.TestCase):
    def test_parse_job_listing_extracts_requested_fields(self):
        job = scrape.parse_job_listing(
            DETAIL_HTML,
            "https://www.cvbankas.lt/operations-manager-kaune/1-13732953",
        )

        self.assertEqual(job["title"], "Operations Manager")
        self.assertEqual(job["salary"], "3400-4400 \u20ac/mon. neatskai\u010dius mokes\u010di\u0173")
        self.assertEqual(job["location"], "\u0160vitrigailos g. 34, LT-03230 Vilnius")
        self.assertEqual(
            job["url"],
            "https://www.cvbankas.lt/operations-manager-kaune/1-13732953",
        )
        self.assertIn("Great Cyber products are not created by accident.", job["description"])
        self.assertIn("We're looking for an experienced and ambitious person.", job["description"])
        self.assertIn("What You Will Do", job["description"])
        self.assertIn("Lead the team.", job["description"])
        self.assertIn("What We Expect From You", job["description"])


class ScrapeJobsTests(unittest.TestCase):
    def test_scrape_jobs_stops_at_requested_count_across_pages(self):
        page_map = {
            "https://www.cvbankas.lt/": LISTING_HTML,
            "https://www.cvbankas.lt/?page=2": SECOND_PAGE_HTML,
            "https://www.cvbankas.lt/pardaveja-as-konsultante-as-pc-mega-pilnu-etatu-kaune/1-13712947": DETAIL_HTML.replace(
                "Operations Manager", "First Role"
            ),
            "https://www.cvbankas.lt/statybos-darbu-vadovas-moletuose/1-9544584": DETAIL_HTML.replace(
                "Operations Manager", "Second Role"
            ),
            "https://www.cvbankas.lt/pardavimu-vadybininkas-vilniuje/1-13494419?foo=bar": DETAIL_HTML.replace(
                "Operations Manager", "Third Role"
            ),
        }

        def fake_fetch(url):
            return page_map[url]

        jobs = scrape.scrape_jobs(3, fetcher=fake_fetch, start_url="https://www.cvbankas.lt/")

        self.assertEqual(len(jobs), 3)
        self.assertEqual([job["title"] for job in jobs], ["First Role", "Second Role", "Third Role"])


class ExportTests(unittest.TestCase):
    def test_export_jobs_to_json_writes_utf8_json(self):
        jobs = [
            {
                "title": "Operations Manager",
                "salary": "3400-4400 \u20ac/mon. neatskai\u010dius mokes\u010di\u0173",
                "description": "Example description",
                "location": "\u0160vitrigailos g. 34, LT-03230 Vilnius",
                "url": "https://www.cvbankas.lt/operations-manager-kaune/1-13732953",
            }
        ]

        with tempfile.TemporaryDirectory() as temp_dir:
            output_path = Path(temp_dir) / "jobs.json"
            scrape.export_jobs_to_json(jobs, output_path)

            written = json.loads(output_path.read_text(encoding="utf-8"))

        self.assertEqual(written, jobs)


class SalaryParsingTests(unittest.TestCase):
    def test_parse_salary_range_extracts_bounds(self):
        self.assertEqual(
            scrape.parse_salary_range("3400-4400 €/mon. neatskaičius mokesčių"),
            (3400.0, 4400.0),
        )

    def test_parse_salary_range_returns_single_value_for_fixed_salary(self):
        self.assertEqual(
            scrape.parse_salary_range("Nuo 2500 €/mon."),
            (2500.0, 2500.0),
        )

    def test_parse_salary_range_handles_missing_salary(self):
        self.assertEqual(scrape.parse_salary_range(""), (None, None))


class DatabaseInsertTests(unittest.TestCase):
    def test_insert_jobs_into_db_creates_and_updates_jobs(self):
        jobs = [
            {
                "title": "Operations Manager",
                "salary": "3400-4400 €/mon. neatskaičius mokesčių",
                "description": "Example description",
                "location": "Švitrigailos g. 34, LT-03230 Vilnius",
                "url": "https://www.cvbankas.lt/operations-manager-kaune/1-13732953",
            }
        ]

        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = Path(temp_dir) / "jobfinder.db"

            inserted = scrape.insert_jobs_into_db(jobs, db_path)
            self.assertEqual(inserted, 1)

            updated_jobs = [
                {
                    "title": "Senior Operations Manager",
                    "salary": "5000 €/mon.",
                    "description": "Updated description",
                    "location": "Kaunas",
                    "url": "https://www.cvbankas.lt/operations-manager-kaune/1-13732953",
                }
            ]

            updated = scrape.insert_jobs_into_db(updated_jobs, db_path)
            self.assertEqual(updated, 1)

            with sqlite3.connect(db_path) as connection:
                row = connection.execute(
                    """
                    SELECT title, salary_min, salary_max, address, url
                    FROM jobs
                    """
                ).fetchone()

        self.assertEqual(
            row,
            (
                "Senior Operations Manager",
                5000.0,
                5000.0,
                "Kaunas",
                "https://www.cvbankas.lt/operations-manager-kaune/1-13732953",
            ),
        )


if __name__ == "__main__":
    unittest.main()
