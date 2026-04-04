const fs = require('fs');
const path = require('path');

describe('job-search map marker info card popup', () => {
  const scriptPath = path.resolve(__dirname, '../../../frontend/job-search.js');
  const script = fs.readFileSync(scriptPath, 'utf8');

  test('renders popup as a map job card with key job fields', () => {
    expect(script).toMatch(/map-job-card/);
    expect(script).toMatch(/map-job-title/);
    expect(script).toMatch(/map-job-meta/);
    expect(script).toMatch(/map-job-label/);
    expect(script).toMatch(/Company:/);
    expect(script).toMatch(/Location:/);
    expect(script).toMatch(/Salary:/);
    expect(script).toMatch(/Type:/);
  });

  test('includes popup link CTA for available job url', () => {
    expect(script).toMatch(/map-job-link/);
    expect(script).toMatch(/Open listing/);
    expect(script).toMatch(/rel="noopener noreferrer"/);
    expect(script).toMatch(/target="_blank"/);
  });

  test('binds marker popup with card-specific popup class', () => {
    expect(script).toMatch(/bindPopup\(buildPopupHtml\(entry\.job\),\s*\{/);
    expect(script).toMatch(/className:\s*"job-map-popup"/);
    expect(script).toMatch(/maxWidth:\s*320/);
  });
});