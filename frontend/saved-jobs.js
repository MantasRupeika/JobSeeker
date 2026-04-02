(function () {
  const API_BASE_URL = window.API_BASE_URL || "http://localhost:3000";
  const TOKEN_STORAGE_KEY = "jobseeker_jwt";

  const container = document.getElementById("savedJobsContainer");
  const feedback = document.getElementById("savedJobsFeedback");
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);

  function setFeedback(message, type) {
    feedback.textContent = message || "";
    feedback.className = "form-feedback";

    if (type === "error") {
      feedback.classList.add("is-error");
    }

    if (type === "success") {
      feedback.classList.add("is-success");
    }
  }

  if (!token) {
    setFeedback("You must be logged in to see saved jobs.", "error");
    return;
  }

  async function loadSavedJobs() {
    try {
      const response = await fetch(API_BASE_URL + "/api/saved-jobs", {
        headers: {
          Authorization: "Bearer " + token
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Nepavyko gauti išsaugotų skelbimų");
      }

      renderJobs(data);
    } catch (error) {
      setFeedback(error.message, "error");
    }
  }

  function renderJobs(jobs) {
    container.innerHTML = "";

    if (!jobs.length) {
      container.innerHTML = `
        <div class="job-card">
          <p>You have no saved jobs yet.</p>
        </div>
      `;
      return;
    }

    jobs.forEach(job => {
      const card = document.createElement("div");
      card.className = "job-card";
      card.innerHTML = `
        <h3>${job.title}</h3>
        <p><strong>Company:</strong> ${job.company || "-"}</p>
        <p><strong>Location:</strong> ${job.address || "-"}</p>
        <div class="job-actions">
          ${job.url ? `<a href="${job.url}" target="_blank">View job</a>` : ""}
          <button data-job-id="${job.job_id}" class="remove-btn">Remove</button>
        </div>
      `;
      container.appendChild(card);
    });

    bindRemoveButtons();
  }

  function bindRemoveButtons() {
    const buttons = document.querySelectorAll(".remove-btn");

    buttons.forEach(button => {
      button.addEventListener("click", async function () {
        const jobId = this.getAttribute("data-job-id");

        try {
          const response = await fetch(API_BASE_URL + "/api/saved-jobs/" + jobId, {
            method: "DELETE",
            headers: {
              Authorization: "Bearer " + token
            }
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Nepavyko pašalinti");
          }

          setFeedback("Saved job removed successfully.", "success");
          loadSavedJobs();
        } catch (error) {
          setFeedback(error.message, "error");
        }
      });
    });
  }

  loadSavedJobs();
})();