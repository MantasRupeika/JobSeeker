const fs = require('fs');
const path = require('path');

describe('job-search page component structure', () => {
  const htmlPath = path.resolve(__dirname, '../../../frontend/job-search.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  test('loads shared stylesheet', () => {
    expect(html).toMatch(/<link\s+rel="stylesheet"\s+href="styles\.css">/i);
  });

  test('contains job grid with one or more job cards', () => {
    expect(html).toMatch(/<section\s+class="job-grid"/i);

    const cards = [...html.matchAll(/<article\s+class="job-card">([\s\S]*?)<\/article>/gi)];
    expect(cards.length).toBeGreaterThan(0);
  });

  test('each job card includes title, company, location and salary', () => {
    const cards = [...html.matchAll(/<article\s+class="job-card">([\s\S]*?)<\/article>/gi)];
    expect(cards.length).toBeGreaterThan(0);

    cards.forEach((match) => {
      const cardHtml = match[1];
      expect(cardHtml).toMatch(/<h2\s+class="job-title">[^<]+<\/h2>/i);
      expect(cardHtml).toMatch(/Company:/i);
      expect(cardHtml).toMatch(/Location:/i);
      expect(cardHtml).toMatch(/Salary:/i);
    });
  });
});
