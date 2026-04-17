(function () {
  var API_BASE_URL = window.API_BASE_URL || (window.location.protocol === "file:" ? "http://localhost:3000" : "");
  var TOKEN_KEYS = ["jobseeker_jwt", "token"];
  var JOBS_PAGE_SIZE = 100;
  var MIN_LOADING_MS = 900;
  var STOP_WORDS = {
    a: true,
    and: true,
    apie: true,
    arba: true,
    as: true,
    bei: true,
    darbas: true,
    darbu: true,
    for: true,
    in: true,
    ir: true,
    is: true,
    it: true,
    job: true,
    of: true,
    su: true,
    the: true,
    to: true,
    yra: true
  };

  var cvSelect = document.getElementById("cvSelect");
  var selectedCvPreview = document.getElementById("selectedCvPreview");
  var runMatchBtn = document.getElementById("runMatchBtn");
  var feedback = document.getElementById("aiFeedback");
  var loader = document.getElementById("aiLoader");
  var loaderStep = document.getElementById("aiLoaderStep");
  var resultsSummary = document.getElementById("aiResultsSummary");
  var resultsGrid = document.getElementById("aiResultsGrid");
  var matchCardTemplate = document.getElementById("aiMatchCardTemplate");

  var cvs = [];
  var activeCv = null;

  if (!cvSelect || !runMatchBtn || !resultsGrid || !matchCardTemplate) {
    return;
  }

  function getToken() {
    for (var index = 0; index < TOKEN_KEYS.length; index += 1) {
      var token = localStorage.getItem(TOKEN_KEYS[index]);
      if (token) {
        return token;
      }
    }

    return "";
  }

  function setFeedback(message, type) {
    if (!feedback) {
      return;
    }

    feedback.textContent = message || "";
    feedback.className = "form-feedback";

    if (type === "error") {
      feedback.classList.add("is-error");
    }

    if (type === "success") {
      feedback.classList.add("is-success");
    }
  }

  function setLoading(isLoading, message) {
    if (loader) {
      loader.hidden = !isLoading;
    }

    if (loaderStep) {
      loaderStep.textContent = message || "Calculating job matches";
    }

    runMatchBtn.disabled = isLoading;
    cvSelect.disabled = isLoading;
  }

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function parseStoredJson(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (_error) {
      return [];
    }
  }

  async function loadCvs() {
    var token = getToken();

    if (token) {
      try {
        var response = await fetch(API_BASE_URL + "/api/cv", {
          headers: {
            Authorization: "Bearer " + token
          }
        });

        if (response.ok) {
          var apiCvs = await response.json();
          if (Array.isArray(apiCvs)) {
            localStorage.setItem("userCVs", JSON.stringify(apiCvs));
            return apiCvs;
          }
        }
      } catch (_error) {
        // Local CVs keep the demo usable when the API is unavailable.
      }
    }

    return parseStoredJson("userCVs");
  }

  function renderCvOptions() {
    cvSelect.innerHTML = "";

    if (!cvs.length) {
      var emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = "No CVs found";
      cvSelect.appendChild(emptyOption);
      runMatchBtn.disabled = true;
      renderSelectedCv(null);
      setFeedback("Create a CV first, then return to this page.", "error");
      return;
    }

    cvs.forEach(function (cv, index) {
      var option = document.createElement("option");
      option.value = String(index);
      option.textContent = cv.name || cv.fullName || "CV " + (index + 1);
      cvSelect.appendChild(option);
    });

    cvSelect.value = "0";
    activeCv = cvs[0];
    renderSelectedCv(activeCv);
    runMatchBtn.disabled = false;
    setFeedback("", "");
  }

  function renderSelectedCv(cv) {
    if (!selectedCvPreview) {
      return;
    }

    if (!cv) {
      selectedCvPreview.innerHTML = "<p>Select a CV to preview the information used for matching.</p>";
      return;
    }

    selectedCvPreview.innerHTML = [
      "<h3>" + escapeHtml(cv.name || cv.fullName || "Selected CV") + "</h3>",
      "<p><strong>Email:</strong> " + escapeHtml(cv.email || "-") + "</p>",
      "<p><strong>Skills:</strong> " + escapeHtml(cv.skills || "-") + "</p>",
      "<p><strong>Experience:</strong> " + escapeHtml(cv.experience || "-") + "</p>",
      "<p><strong>Education:</strong> " + escapeHtml(cv.education || "-") + "</p>"
    ].join("");
  }

  function buildJobsUrl(page) {
    var params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(JOBS_PAGE_SIZE));
    return API_BASE_URL + "/api/jobs?" + params.toString();
  }

  async function loadAllJobs() {
    var firstPage = await fetch(buildJobsUrl(1)).then(function (response) {
      return response.json().then(function (data) {
        if (!response.ok) {
          throw new Error(data.error || "Failed to load jobs.");
        }
        return data;
      });
    });

    var jobs = Array.isArray(firstPage.jobs) ? firstPage.jobs.slice() : [];
    var totalPages = firstPage.pagination && firstPage.pagination.totalPages ? firstPage.pagination.totalPages : 1;

    for (var page = 2; page <= totalPages; page += 1) {
      var pageData = await fetch(buildJobsUrl(page)).then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok) {
            throw new Error(data.error || "Failed to load jobs.");
          }
          return data;
        });
      });

      if (Array.isArray(pageData.jobs)) {
        jobs = jobs.concat(pageData.jobs);
      }
    }

    return jobs.filter(function (job) {
      return normalizeText(job && job.title) && normalizeText(job && job.location);
    });
  }

  function tokenize(value) {
    var searchableText = normalizeText(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    var matches = searchableText.match(/[a-z0-9]+/gi) || [];
    var uniqueTokens = {};

    matches.forEach(function (token) {
      var normalized = token.toLowerCase();
      if (normalized.length < 3 || STOP_WORDS[normalized]) {
        return;
      }
      uniqueTokens[normalized] = true;
    });

    return Object.keys(uniqueTokens);
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

  function buildCvProfile(cv) {
    return {
      name: cv.name || cv.fullName || "Selected CV",
      textTokens: tokenize([
        cv.name,
        cv.fullName,
        cv.education,
        cv.experience,
        cv.skills,
        cv.profession,
        cv.city,
        cv.bio
      ].join(" ")),
      skillTokens: tokenize(cv.skills),
      locationTokens: tokenize([cv.city, cv.location, cv.address].join(" "))
    };
  }

  function countOverlap(sourceTokens, targetTokens) {
    var targetLookup = {};
    var count = 0;

    targetTokens.forEach(function (token) {
      targetLookup[token] = true;
    });

    sourceTokens.forEach(function (token) {
      if (targetLookup[token]) {
        count += 1;
      }
    });

    return count;
  }

  function calculateMatch(cvProfile, job) {
    var jobTokens = tokenize([
      job.title,
      job.company,
      job.location,
      job.jobType
    ].join(" "));
    var skillOverlap = countOverlap(cvProfile.skillTokens, jobTokens);
    var textOverlap = countOverlap(cvProfile.textTokens, jobTokens);
    var locationOverlap = countOverlap(cvProfile.locationTokens, tokenize(job.location));

    var score = 34;
    score += Math.min(32, textOverlap * 8);
    score += Math.min(24, skillOverlap * 12);
    score += Math.min(8, locationOverlap * 8);

    if (Number.isFinite(Number(job.salaryMin)) || Number.isFinite(Number(job.salaryMax))) {
      score += 4;
    }

    if (job.url) {
      score += 2;
    }

    score = Math.max(35, Math.min(98, score));

    var reasons = [];
    if (skillOverlap > 0) {
      reasons.push("skills match job keywords");
    }
    if (textOverlap > 0) {
      reasons.push("CV text is related to the job title");
    }
    if (locationOverlap > 0) {
      reasons.push("location matches your profile");
    }
    if (!reasons.length) {
      reasons.push("basic job data is available, but keyword match is limited");
    }

    return {
      job: job,
      score: score,
      reasons: reasons
    };
  }

  function scoreToStars(score) {
    var filled = Math.max(1, Math.round(score / 20));
    var stars = "";

    for (var index = 1; index <= 5; index += 1) {
      stars += index <= filled ? "*" : "-";
    }

    return stars;
  }

  function renderResults(matches) {
    resultsGrid.innerHTML = "";

    if (!matches.length) {
      resultsSummary.textContent = "No jobs were available for matching.";
      resultsGrid.innerHTML = '<article class="ai-empty-state">No jobs found. Run the scraper first and try again.</article>';
      return;
    }

    resultsSummary.textContent = "Showing top " + matches.length + " AI-ranked jobs for " + (activeCv.name || activeCv.fullName || "your CV") + ".";

    var fragment = document.createDocumentFragment();

    matches.forEach(function (match) {
      var clone = matchCardTemplate.content.cloneNode(true);
      var scoreRing = clone.querySelector('[data-job="score-ring"]');
      var scoreNode = clone.querySelector('[data-job="score"]');
      var starsNode = clone.querySelector('[data-job="stars"]');
      var titleNode = clone.querySelector('[data-job="title"]');
      var locationNode = clone.querySelector('[data-job="location"]');
      var salaryNode = clone.querySelector('[data-job="salary"]');
      var reasonNode = clone.querySelector('[data-job="reason"]');
      var openLink = clone.querySelector('[data-job="open-link"]');
      var saveButton = clone.querySelector('[data-job="save-button"]');

      if (scoreRing) {
        scoreRing.style.setProperty("--score", match.score + "%");
      }
      if (scoreNode) {
        scoreNode.textContent = match.score + "%";
      }
      if (starsNode) {
        starsNode.textContent = scoreToStars(match.score);
      }
      if (titleNode) {
        titleNode.textContent = match.job.title || "Untitled role";
      }
      if (locationNode) {
        locationNode.textContent = match.job.location || "-";
      }
      if (salaryNode) {
        salaryNode.textContent = formatSalary(match.job.salaryMin, match.job.salaryMax);
      }
      if (reasonNode) {
        reasonNode.textContent = "Why this matched: " + match.reasons.join(", ") + ".";
      }
      if (openLink) {
        if (match.job.url) {
          openLink.href = match.job.url;
        } else {
          openLink.hidden = true;
        }
      }
      if (saveButton) {
        saveButton.addEventListener("click", function () {
          saveJob(match.job.id);
        });
      }

      fragment.appendChild(clone);
    });

    resultsGrid.appendChild(fragment);
  }

  async function saveJob(jobId) {
    var token = getToken();

    if (!token) {
      setFeedback("You must be logged in to save jobs.", "error");
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

      setFeedback("Job saved successfully.", "success");
    } catch (error) {
      setFeedback(error.message || "Failed to save job.", "error");
    }
  }

  function delay(milliseconds) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, milliseconds);
    });
  }

  async function runMatching() {
    if (!activeCv) {
      setFeedback("Select a CV first.", "error");
      return;
    }

    setFeedback("", "");
    setLoading(true, "Reading selected CV");
    resultsSummary.textContent = "AI is calculating your best matches...";
    resultsGrid.innerHTML = "";

    var startedAt = Date.now();

    try {
      await delay(250);
      setLoading(true, "Loading jobs from database");
      var jobs = await loadAllJobs();
      setLoading(true, "Comparing CV keywords with job listings");

      var cvProfile = buildCvProfile(activeCv);
      var matches = jobs
        .map(function (job) {
          return calculateMatch(cvProfile, job);
        })
        .sort(function (left, right) {
          return right.score - left.score;
        })
        .slice(0, 12);

      var elapsed = Date.now() - startedAt;
      if (elapsed < MIN_LOADING_MS) {
        await delay(MIN_LOADING_MS - elapsed);
      }

      renderResults(matches);
      setFeedback("Matching completed.", "success");
    } catch (error) {
      resultsSummary.textContent = "Could not calculate matches.";
      setFeedback(error.message || "AI matching failed.", "error");
    } finally {
      setLoading(false, "");
    }
  }

  cvSelect.addEventListener("change", function () {
    var index = Number(cvSelect.value);
    activeCv = Number.isInteger(index) ? cvs[index] : null;
    renderSelectedCv(activeCv);
  });

  runMatchBtn.addEventListener("click", runMatching);

  (async function initialize() {
    setFeedback("Loading your CV list...", "");
    cvs = await loadCvs();
    renderCvOptions();
  })();
})();
