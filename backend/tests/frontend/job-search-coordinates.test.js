const fs = require('fs');
const path = require('path');

describe('job-search stored coordinate usage', () => {
  const scriptPath = path.resolve(__dirname, '../../../frontend/job-search.js');
  const script = fs.readFileSync(scriptPath, 'utf8');

  test('prefers stored lat and lng before calling geocoding service', () => {
    const getCoordinatesMatch = script.match(/async function getJobCoordinates\(job\)\s*\{([\s\S]*?)\r?\n\s*}\r?\n\r?\n\s*async function updateMap/);
    expect(getCoordinatesMatch).not.toBeNull();

    const getCoordinatesBody = getCoordinatesMatch[1];
    const latIndex = getCoordinatesBody.indexOf('Number(job && job.lat)');
    const lngIndex = getCoordinatesBody.indexOf('Number(job && job.lng)');
    const returnIndex = getCoordinatesBody.indexOf('return { lat: lat, lng: lng };');
    const geocoderIndex = getCoordinatesBody.indexOf('window.geocodingService');

    expect(latIndex).toBeGreaterThan(-1);
    expect(lngIndex).toBeGreaterThan(-1);
    expect(returnIndex).toBeGreaterThan(-1);
    expect(geocoderIndex).toBeGreaterThan(-1);
    expect(returnIndex).toBeLessThan(geocoderIndex);
  });
});
