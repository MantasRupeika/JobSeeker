(function () {
  var API_BASE_URL = window.API_BASE_URL || "http://localhost:3000";
  var TOKEN_STORAGE_KEY = "jobseeker_jwt";
  var jobGrid = document.getElementById("jobGrid");
  var jobCardTemplate = document.getElementById("jobCardTemplate");
  var jobsStatus = document.getElementById("jobsStatus");
  var jobsCount = document.getElementById("jobsCount");
  var jobTypeFilter = document.getElementById("jobTypeFilter");
  var locationFilter = document.getElementById("locationFilter");
  var salaryMinFilter = document.getElementById("salaryMinFilter");
  var salaryMaxFilter = document.getElementById("salaryMaxFilter");

  if (!jobGrid || !jobCardTemplate) {
    return;
  }

  var allJobs = [];

  function setStatus(message, isError) {
    if (!jobsStatus) {
      return;
    }

    jobsStatus.textContent = message || "";
    jobsStatus.classList.toggle("is-error", Boolean(isError));
    jobsStatus.classList.toggle("is-loading", message === "Loading jobs...");
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

  function salaryMatches(job, minFilter, maxFilter) {
    var min = Number(job.salaryMin);
    var max = Number(job.salaryMax);
    var hasMin = Number.isFinite(min);
    var hasMax = Number.isFinite(max);

    if (!hasMin && !hasMax) {
      return minFilter === null && maxFilter === null;
    }

    var rangeMin = hasMin ? min : max;
    var rangeMax = hasMax ? max : min;

    if (minFilter !== null && rangeMax < minFilter) {
      return false;
    }

    if (maxFilter !== null && rangeMin > maxFilter) {
      return false;
    }

    return true;
  }

  function getFilteredJobs() {
    var jobType = normalizeText(jobTypeFilter && jobTypeFilter.value);
    var location = normalizeText(locationFilter && locationFilter.value);

    var minRaw = salaryMinFilter && salaryMinFilter.value !== "" ? Number(salaryMinFilter.value) : null;
    var maxRaw = salaryMaxFilter && salaryMaxFilter.value !== "" ? Number(salaryMaxFilter.value) : null;

    var minFilter = Number.isFinite(minRaw) ? minRaw : null;
    var maxFilter = Number.isFinite(maxRaw) ? maxRaw : null;

    return allJobs.filter(function (job) {
      var jobTypeValue = normalizeText(job.jobType);
      var locationValue = normalizeText(job.location);

      var matchesType = !jobType || jobTypeValue === jobType;
      var matchesLocation = !location || locationValue.indexOf(location) !== -1;
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
        "Authorization": "Bearer " + token
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

  function renderJobs() {
    var jobs = getFilteredJobs();

    jobGrid.innerHTML = "";

    if (jobsCount) {
      jobsCount.textContent = jobs.length + " jobs found";
    }

    if (jobs.length === 0) {
      setStatus("No jobs match current filters.", false);
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
  }

  async function loadJobsFromDb() {
    setStatus("Loading jobs...", false);

    try {
      var response = await fetch(API_BASE_URL + "/api/jobs");
      var data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load jobs.");
      }

      allJobs = Array.isArray(data.jobs) ? data.jobs : [];
      renderJobs();
    } catch (error) {
      setStatus(error.message || "Failed to load jobs.", true);
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
