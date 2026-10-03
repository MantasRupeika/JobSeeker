(function () {
  var cache = new Map();

  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function geocodeAddress(address, options) {
    var normalized = normalize(address);

    if (!normalized) {
      return Promise.resolve(null);
    }

    if (cache.has(normalized)) {
      return cache.get(normalized);
    }

    var country = options && options.country ? String(options.country).trim() : "Lithuania";
    var query = address + ", " + country;

    var request = fetch(
      "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" + encodeURIComponent(query),
      {
        headers: {
          Accept: "application/json"
        }
      }
    )
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Unable to geocode address.");
        }

        return response.json();
      })
      .then(function (results) {
        if (!Array.isArray(results) || results.length === 0) {
          return null;
        }

        var firstResult = results[0];
        var lat = Number(firstResult.lat);
        var lng = Number(firstResult.lon);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return null;
        }

        return {
          lat: lat,
          lng: lng
        };
      })
      .catch(function () {
        return null;
      });

    cache.set(normalized, request);
    return request;
  }

  window.geocodingService = {
    geocodeAddress: geocodeAddress
  };
})();