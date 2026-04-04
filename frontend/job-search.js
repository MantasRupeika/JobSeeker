(function () {
  var API_BASE_URL = window.API_BASE_URL || (window.location.protocol === "file:" ? "http://localhost:3000" : "");
  var TOKEN_STORAGE_KEY = "jobseeker_jwt";
  var RESULTS_PAGE_SIZE = 100;
  var FILTER_DEBOUNCE_MS = 250;

  var jobGrid = document.getElementById("jobGrid");
  var jobCardTemplate = document.getElementById("jobCardTemplate");
  var jobsStatus = document.getElementById("jobsStatus");
  var jobsCount = document.getElementById("jobsCount");
  var jobTypeFilter = document.getElementById("jobTypeFilter");
  var locationFilter = document.getElementById("locationFilter");
  var salaryMinFilter = document.getElementById("salaryMinFilter");
  var salaryMaxFilter = document.getElementById("salaryMaxFilter");

  var renderedJobs = [];
  var activeRequestId = 0;
  var filterDebounceId = null;

  if (!jobGrid || !jobCardTemplate) {
    return;
  }

  function setStatus(message, isError, isLoading) {
    if (!jobsStatus) {
      return;
    }

    jobsStatus.textContent = message || "";
    jobsStatus.classList.toggle("is-error", Boolean(isError));
    jobsStatus.classList.toggle("is-loading", Boolean(isLoading));
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

  function renderJobs() {
    jobGrid.innerHTML = "";

    if (jobsCount) {
      jobsCount.textContent = renderedJobs.length + " jobs found";
    }

    if (renderedJobs.length === 0) {
      setStatus("No jobs match current filters.", false, false);
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

      if (jobsCount) {
        jobsCount.textContent = "0 jobs found";
      }

      setStatus(error.message || "Failed to load jobs.", true, false);
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
