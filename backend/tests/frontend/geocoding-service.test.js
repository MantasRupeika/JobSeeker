const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadServiceWithFetch(fetchMock) {
  const scriptPath = path.resolve(__dirname, '../../../frontend/geocoding-service.js');
  const source = fs.readFileSync(scriptPath, 'utf8');

  const context = {
    window: {},
    fetch: fetchMock,
    Map,
    Promise,
    encodeURIComponent,
    String,
    Number,
    Array
  };

  vm.createContext(context);
  vm.runInContext(source, context);

  return context.window.geocodingService;
}

describe('frontend geocoding service', () => {
  test('exposes geocodeAddress function', () => {
    const fetchMock = jest.fn();
    const service = loadServiceWithFetch(fetchMock);

    expect(service).toBeDefined();
    expect(typeof service.geocodeAddress).toBe('function');
  });

  test('returns null and does not call fetch for empty address', async () => {
    const fetchMock = jest.fn();
    const service = loadServiceWithFetch(fetchMock);

    await expect(service.geocodeAddress('   ')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('returns coordinates on successful geocoding response', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ lat: '54.6872', lon: '25.2797' }]
    });

    const service = loadServiceWithFetch(fetchMock);
    const result = await service.geocodeAddress('Vilnius');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('nominatim.openstreetmap.org/search');
    expect(fetchMock.mock.calls[0][0]).toContain(encodeURIComponent('Vilnius, Lithuania'));
    expect(result).toEqual({ lat: 54.6872, lng: 25.2797 });
  });

  test('caches requests by normalized address', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ lat: '54.6872', lon: '25.2797' }]
    });

    const service = loadServiceWithFetch(fetchMock);

    const first = await service.geocodeAddress(' Vilnius ');
    const second = await service.geocodeAddress('vilnius');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
  });

  test('returns null when provider response is not ok', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({})
    });

    const service = loadServiceWithFetch(fetchMock);

    await expect(service.geocodeAddress('Kaunas')).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});