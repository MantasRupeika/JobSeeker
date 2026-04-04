(function () {
  var API_BASE_URL = window.API_BASE_URL || (window.location.protocol === "file:" ? "http://localhost:3000" : "");
  var TOKEN_STORAGE_KEY = "jobseeker_jwt";
  var RESULTS_PAGE_SIZE = 100;
  var FILTER_DEBOUNCE_MS = 250;

  var jobGrid = document.getElementById("jobGrid");
  var jobCardTemplate = document.getElementById("jobCardTemplate");
  var jobsStatus = document.getElementById("jobsStatus");
  var jobsCount = document.getElementById("jobsCount");
  var jobMapElement = document.getElementById("jobMap");
  var jobMapStatus = document.getElementById("jobMapStatus");
  var jobTypeFilter = document.getElementById("jobTypeFilter");
  var locationFilter = document.getElementById("locationFilter");
  var salaryMinFilter = document.getElementById("salaryMinFilter");
  var salaryMaxFilter = document.getElementById("salaryMaxFilter");

  var renderedJobs = [];
  var activeRequestId = 0;
  var filterDebounceId = null;
  var mapInstance = null;
  var markerLayer = null;
  var mapUpdateToken = 0;

  if (!jobGrid || !jobCardTemplate) {
    return;
  }

  initializeMap();

  function setStatus(message, isError, isLoading) {
    if (!jobsStatus) {
      return;
    }

    jobsStatus.textContent = message || "";
    jobsStatus.classList.toggle("is-error", Boolean(isError));
    jobsStatus.classList.toggle("is-loading", Boolean(isLoading));
  }

  function setMapStatus(message, isError) {
    if (!jobMapStatus) {
      return;
    }

    jobMapStatus.textContent = message || "";
    jobMapStatus.classList.toggle("is-error", Boolean(isError));
  }

  function formatSalary(salaryMin, salaryMax) {
    var min = Number(salaryMin);
    var max = Number(salaryMax);
    var hasMin = Number.isFinite(min);
    var hasMax = Number.isFinite(max);

    if (hasMin && hasMax) {
      return min + " - " + max + " EUR / month";
    }

    if (hasMin) {
      return "From " + min + " EUR / month";
    }

    if (hasMax) {
      return "Up to " + max + " EUR / month";
    }

    return "Not specified";
  }

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function hasValidLocation(job) {
    return normalizeText(job && job.location).length > 0;
  }

  function parseNumberFilter(input) {
    if (!input) {
      return null;
    }

    var rawValue = normalizeText(input.value);
    if (!rawValue) {
      return null;
    }

    var parsedValue = Number(rawValue);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  function getFilterState() {
    return {
      jobType: normalizeText(jobTypeFilter && jobTypeFilter.value),
      location: normalizeText(locationFilter && locationFilter.value),
      salaryMin: parseNumberFilter(salaryMinFilter),
      salaryMax: parseNumberFilter(salaryMaxFilter)
    };
  }

  function validateFilterState(filterState) {
    if (
      filterState.salaryMin !== null &&
      filterState.salaryMax !== null &&
      filterState.salaryMin > filterState.salaryMax
    ) {
      return "Minimum salary cannot be greater than maximum salary.";
    }

    return "";
  }

  function buildJobsUrl(filterState, page) {
    var params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(RESULTS_PAGE_SIZE));

    if (filterState.jobType) {
      params.set("jobType", filterState.jobType);
    }

    if (filterState.location) {
      params.set("location", filterState.location);
    }

    if (filterState.salaryMin !== null) {
      params.set("salaryMin", String(filterState.salaryMin));
    }

    if (filterState.salaryMax !== null) {
      params.set("salaryMax", String(filterState.salaryMax));
    }

    return API_BASE_URL + "/api/jobs?" + params.toString();
  }

  function formatJobTypeLabel(jobType) {
    return String(jobType)
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map(function (part) {
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      })
      .join(" ");
  }

  function updateJobTypeFilterOptions(jobs) {
    if (!jobTypeFilter) {
      return;
    }

    var currentValue = normalizeText(jobTypeFilter.value);
    var distinctTypes = [];
    var seenTypes = {};

    jobs.forEach(function (job) {
      var jobType = normalizeText(job.jobType);
      var normalizedKey = jobType.toLowerCase();

      if (!jobType || seenTypes[normalizedKey]) {
        return;
      }

      seenTypes[normalizedKey] = true;
      distinctTypes.push(jobType);
    });

    if (currentValue && !seenTypes[currentValue.toLowerCase()]) {
      distinctTypes.unshift(currentValue);
    }

    jobTypeFilter.innerHTML = "";

    var allOption = document.createElement("option");
    allOption.value = "";
    allOption.textContent = "All types";
    jobTypeFilter.appendChild(allOption);

    distinctTypes.sort(function (left, right) {
      return left.localeCompare(right);
    }).forEach(function (jobType) {
      var option = document.createElement("option");
      option.value = jobType;
      option.textContent = formatJobTypeLabel(jobType);
      jobTypeFilter.appendChild(option);
    });

    jobTypeFilter.value = currentValue;
    jobTypeFilter.disabled = distinctTypes.length === 0;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getToken() {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  }

  async function saveJob(jobId) {
    var token = getToken();

    if (!token) {
      setStatus("You must be logged in to save jobs.", true, false);
      return;
    }

    try {
      var response = await fetch(API_BASE_URL + "/api/saved-jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify({ jobId: jobId })
      });

      var data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save job.");
      }

      setStatus("Job saved successfully.", false, false);
    } catch (error) {
      setStatus(error.message || "Failed to save job.", true, false);
    }
  }

  function initializeMap() {
    if (!jobMapElement || !window.L || mapInstance) {
      return;
    }

    mapInstance = window.L.map(jobMapElement, {
      scrollWheelZoom: false
    }).setView([55.1694, 23.8813], 7);

    window.L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 20,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(mapInstance);

    markerLayer = window.L.layerGroup().addTo(mapInstance);
    setMapStatus("Map is ready.", false);
  }

  function buildPopupHtml(job) {
    var jobUrl = job.url ? String(job.url).trim() : "";

    return [
      '<article class="map-job-card">',
      '<h3 class="map-job-title">' + escapeHtml(job.title || "Untitled role") + '</h3>',
      '<p class="map-job-meta"><span class="map-job-label">Company:</span> ' + escapeHtml(job.company) + '</p>',
      '<p class="map-job-meta"><span class="map-job-label">Location:</span> ' + escapeHtml(job.location) + '</p>',
      '<p class="map-job-meta"><span class="map-job-label">Salary:</span> ' + escapeHtml(formatSalary(job.salaryMin, job.salaryMax)) + '</p>',
      '<p class="map-job-meta"><span class="map-job-label">Type:</span> ' + escapeHtml(job.jobType || "") + '</p>',
      jobUrl ? '<a class="map-job-link" href="' + escapeHtml(jobUrl) + '" target="_blank" rel="noopener noreferrer">Open listing</a>' : '',
      '</article>'
    ].join("");
  }

  async function getJobCoordinates(job) {
    if (window.geocodingService && typeof window.geocodingService.geocodeAddress === "function") {
      return window.geocodingService.geocodeAddress(job.location, {
        country: "Lithuania"
      });
    }

    return null;
  }

  async function updateMap(jobs) {
    if (!jobMapElement || !window.L) {
      return;
    }

    initializeMap();

    if (!mapInstance || !markerLayer) {
      return;
    }

    var updateToken = ++mapUpdateToken;
    markerLayer.clearLayers();

    if (jobs.length === 0) {
      setMapStatus("No jobs to plot for the current filters.", false);
      return;
    }

    setMapStatus("Updating map...", false);

    var mappedJobs = await Promise.all(
      jobs.map(async function (job) {
        var coordinates = await getJobCoordinates(job);

        if (!coordinates) {
          return null;
        }

        return {
          job: job,
          coordinates: coordinates
        };
      })
    );

    if (updateToken !== mapUpdateToken) {
      return;
    }

    var visibleJobs = mappedJobs.filter(Boolean);

    if (visibleJobs.length === 0) {
      setMapStatus("No mappable jobs in the current results.", false);
      return;
    }

    var bounds = [];

    visibleJobs.forEach(function (entry) {
      var marker = window.L.marker([entry.coordinates.lat, entry.coordinates.lng]);
      marker.bindPopup(buildPopupHtml(entry.job), {
        maxWidth: 320,
        className: "job-map-popup"
      });
      marker.addTo(markerLayer);
      bounds.push([entry.coordinates.lat, entry.coordinates.lng]);
    });

    if (bounds.length === 1) {
      mapInstance.setView(bounds[0], 11);
    } else {
      mapInstance.fitBounds(bounds, {
        padding: [30, 30],
        maxZoom: 11
      });
    }

    setMapStatus(visibleJobs.length + " mapped jobs shown on the map.", false);
  }

  function renderJobs() {
    jobGrid.innerHTML = "";

    if (jobsCount) {
      jobsCount.textContent = renderedJobs.length + " jobs found";
    }

    if (renderedJobs.length === 0) {
      setStatus("No jobs match current filters.", false, false);
      updateMap([]);
      return;
    }

    setStatus("", false, false);

    var fragment = document.createDocumentFragment();

    renderedJobs.forEach(function (job) {
      var clone = jobCardTemplate.content.cloneNode(true);

      var titleNode = clone.querySelector(".job-title");
      if (titleNode) {
        titleNode.textContent = job.title || "Untitled role";
      }

      var companyNode = clone.querySelector('[data-job="company"]');
      if (companyNode) {
        companyNode.textContent = job.company || "";
      }

      var locationNode = clone.querySelector('[data-job="location"]');
      if (locationNode) {
        locationNode.textContent = job.location;
      }

      var salaryNode = clone.querySelector('[data-job="salary"]');
      if (salaryNode) {
        salaryNode.textContent = formatSalary(job.salaryMin, job.salaryMax);
      }

      var saveButton = clone.querySelector('[data-job="save-button"]');
      if (saveButton) {
        saveButton.addEventListener("click", function () {
          saveJob(job.id);
        });
      }

      fragment.appendChild(clone);
    });

    jobGrid.appendChild(fragment);
    updateMap(renderedJobs);
  }

  async function fetchJobsPage(filterState, page) {
    var response = await fetch(buildJobsUrl(filterState, page));
    var data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to load jobs.");
    }

    return data;
  }

  async function loadJobs() {
    var filterState = getFilterState();
    var validationError = validateFilterState(filterState);

    if (validationError) {
      renderedJobs = [];
      renderJobs();
      setStatus(validationError, true, false);
      return;
    }

    activeRequestId += 1;
    var requestId = activeRequestId;

    setStatus("Loading jobs...", false, true);
    setMapStatus("Loading map data...", false);

    try {
      var firstPage = await fetchJobsPage(filterState, 1);
      var jobs = Array.isArray(firstPage.jobs) ? firstPage.jobs.slice() : [];
      var totalPages = firstPage.pagination && firstPage.pagination.totalPages ? firstPage.pagination.totalPages : 1;

      for (var page = 2; page <= totalPages; page += 1) {
        var pageData = await fetchJobsPage(filterState, page);
        if (Array.isArray(pageData.jobs)) {
          jobs = jobs.concat(pageData.jobs);
        }
      }

      jobs = jobs.filter(hasValidLocation);

      if (requestId !== activeRequestId) {
        return;
      }

      renderedJobs = jobs;
      updateJobTypeFilterOptions(jobs);
      renderJobs();
    } catch (error) {
      if (requestId !== activeRequestId) {
        return;
      }

      renderedJobs = [];
      jobGrid.innerHTML = "";
      mapUpdateToken += 1;

      if (markerLayer) {
        markerLayer.clearLayers();
      }

      if (jobsCount) {
        jobsCount.textContent = "0 jobs found";
      }

      setStatus(error.message || "Failed to load jobs.", true, false);
      setMapStatus("Map data could not be loaded.", true);
    }
  }

  function scheduleLoadJobs() {
    if (filterDebounceId) {
      window.clearTimeout(filterDebounceId);
    }

    filterDebounceId = window.setTimeout(function () {
      loadJobs();
    }, FILTER_DEBOUNCE_MS);
  }

  [jobTypeFilter, locationFilter, salaryMinFilter, salaryMaxFilter].forEach(function (filter) {
    if (!filter) {
      return;
    }

    filter.addEventListener("input", scheduleLoadJobs);
    filter.addEventListener("change", scheduleLoadJobs);
  });

  loadJobs();
})();
