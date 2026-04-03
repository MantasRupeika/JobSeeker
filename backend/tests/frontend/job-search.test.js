const fs = require('fs');
const path = require('path');

describe('job-search page component structure', () => {
  const htmlPath = path.resolve(__dirname, '../../../frontend/job-search.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  test('loads shared stylesheet', () => {
    expect(html).toMatch(/<link\s+rel="stylesheet"\s+href="styles\.css">/i);
  });

  test('contains JobFilters component fields', () => {
    expect(html).toMatch(/id="job-filters-heading"/i);
    expect(html).toMatch(/id="jobTypeFilter"/i);
    expect(html).toMatch(/id="locationFilter"/i);
    expect(html).toMatch(/id="salaryMinFilter"/i);
    expect(html).toMatch(/id="salaryMaxFilter"/i);
  });

  test('contains dynamic grid and job-card template with required info fields', () => {
    expect(html).toMatch(/id="jobGrid"/i);
    expect(html).toMatch(/id="jobCardTemplate"/i);

    const templateMatch = html.match(/<template\s+id="jobCardTemplate">([\s\S]*?)<\/template>/i);
    expect(templateMatch).not.toBeNull();

    const templateHtml = templateMatch[1];
    expect(templateHtml).toMatch(/class="job-card"/i);
    expect(templateHtml).toMatch(/class="job-title"/i);
    expect(templateHtml).toMatch(/Company:/i);
    expect(templateHtml).toMatch(/Location:/i);
    expect(templateHtml).toMatch(/Salary:/i);
  });

  test('loads job-search script', () => {
    expect(html).toMatch(/<script\s+src="job-search\.js"><\/script>/i);
  });
});
