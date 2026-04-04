(function () {
  var API_BASE_URL = window.API_BASE_URL || "http://localhost:3000";
  var TOKEN_STORAGE_KEY = "jobseeker_jwt";

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

  if (!jobGrid || !jobCardTemplate) {
    return;
  }

  var allJobs = [];
  var mapInstance = null;
  var markerLayer = null;
  var mapUpdateToken = 0;

  initializeMap();

  function setStatus(message, isError) {
    if (!jobsStatus) {
      return;
    }

    jobsStatus.textContent = message || "";
    jobsStatus.classList.toggle("is-error", Boolean(isError));
    jobsStatus.classList.toggle("is-loading", message === "Loading jobs...");
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
    return String(value || "").trim().toLowerCase();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function salaryMatches(job, minFilter, maxFilter) {
    var jobMin = Number(job.salaryMin);
    var jobMax = Number(job.salaryMax);
    var hasMin = Number.isFinite(jobMin);
    var hasMax = Number.isFinite(jobMax);

    if (!hasMin && !hasMax) {
      return minFilter === null && maxFilter === null;
    }

    var rangeMin = hasMin ? jobMin : jobMax;
    var rangeMax = hasMax ? jobMax : jobMin;

    if (minFilter !== null && rangeMax < minFilter) {
      return false;
    }

    if (maxFilter !== null && rangeMin > maxFilter) {
      return false;
    }

    return true;
  }

  function getFilteredJobs() {
    var selectedJobType = normalizeText(jobTypeFilter && jobTypeFilter.value);
    var selectedLocation = normalizeText(locationFilter && locationFilter.value);
    var minRaw = salaryMinFilter && salaryMinFilter.value !== "" ? Number(salaryMinFilter.value) : null;
    var maxRaw = salaryMaxFilter && salaryMaxFilter.value !== "" ? Number(salaryMaxFilter.value) : null;
    var minFilter = Number.isFinite(minRaw) ? minRaw : null;
    var maxFilter = Number.isFinite(maxRaw) ? maxRaw : null;

    return allJobs.filter(function (job) {
      var jobTypeValue = normalizeText(job.jobType);
      var locationValue = normalizeText(job.location);

      var matchesType = !selectedJobType || jobTypeValue === selectedJobType;
      var matchesLocation = !selectedLocation || locationValue.indexOf(selectedLocation) !== -1;
      var matchesSalary = salaryMatches(job, minFilter, maxFilter);

      return matchesType && matchesLocation && matchesSalary;
    });
  }

  function getToken() {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  }

  async function saveJob(jobId) {
    var token = getToken();

    if (!token) {
      setStatus("You must be logged in to save jobs.", true);
      return;
    }

    try {
      var response = await fetch(API_BASE_URL + "/api/saved-jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify({ jobId: jobId })
      });

      var data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save job.");
      }

      setStatus("Job saved successfully.", false);
    } catch (error) {
      setStatus(error.message || "Failed to save job.", true);
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
    return [
      '<div class="map-popup">',
      '<strong>' + escapeHtml(job.title || "Untitled role") + '</strong>',
      '<div>' + escapeHtml(job.company || "Not specified") + '</div>',
      '<div>' + escapeHtml(job.location || "Not specified") + '</div>',
      '<div>' + escapeHtml(formatSalary(job.salaryMin, job.salaryMax)) + '</div>',
      '</div>'
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

    markerLayer.clearLayers();

    var visibleJobs = mappedJobs.filter(Boolean);

    if (visibleJobs.length === 0) {
      setMapStatus("No mappable jobs in the current results.", false);
      return;
    }

    var bounds = [];

    visibleJobs.forEach(function (entry) {
      var marker = window.L.marker([entry.coordinates.lat, entry.coordinates.lng]);
      marker.bindPopup(buildPopupHtml(entry.job));
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
    var jobs = getFilteredJobs();

    jobGrid.innerHTML = "";

    if (jobsCount) {
      jobsCount.textContent = jobs.length + " jobs found";
    }

    if (jobs.length === 0) {
      mapUpdateToken += 1;

      if (markerLayer) {
        markerLayer.clearLayers();
      }

      setStatus("No jobs match current filters.", false);
      setMapStatus("No jobs to plot for the current filters.", false);
      return;
    }

    setStatus("", false);

    var fragment = document.createDocumentFragment();

    jobs.forEach(function (job) {
      var clone = jobCardTemplate.content.cloneNode(true);

      var titleNode = clone.querySelector(".job-title");
      if (titleNode) {
        titleNode.textContent = job.title || "Untitled role";
      }

      var companyNode = clone.querySelector('[data-job="company"]');
      if (companyNode) {
        companyNode.textContent = job.company || "Not specified";
      }

      var locationNode = clone.querySelector('[data-job="location"]');
      if (locationNode) {
        locationNode.textContent = job.location || "Not specified";
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
    updateMap(jobs);
  }

  async function loadJobsFromDb() {
    setStatus("Loading jobs...", false);
    setMapStatus("Loading map data...", false);
    initializeMap();

    try {
      var response = await fetch(API_BASE_URL + "/api/jobs");
      var data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load jobs.");
      }

      allJobs = Array.isArray(data.jobs) ? data.jobs : [];
      renderJobs();
    } catch (error) {
      allJobs = [];
      renderJobs();
      setStatus("No jobs are available yet.", false);
      setMapStatus("Map is ready. No job markers yet.", false);

      if (jobsCount) {
        jobsCount.textContent = "0 jobs found";
      }
    }
  }

  [jobTypeFilter, locationFilter, salaryMinFilter, salaryMaxFilter].forEach(function (filter) {
    if (!filter) {
      return;
    }

    filter.addEventListener("input", renderJobs);
    filter.addEventListener("change", renderJobs);
  });

  loadJobsFromDb();
})();