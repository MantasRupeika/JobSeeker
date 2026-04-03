(function () {
  var form = document.getElementById("cvForm");
  if (!form) {
    return;
  }

  var previewBtn = document.getElementById("previewBtn");
  var previewContainer = document.getElementById("cvPreview");
  var closePreviewBtn = document.getElementById("closePreviewBtn");
  var phoneInput = document.getElementById("phone");
  var feedback = document.getElementById("cvFeedback");
  var submitButton = form.querySelector("button[type='submit']");

  var hasPreview = false;

  function setFeedback(message, isError) {
    if (!feedback) {
      return;
    }

    feedback.textContent = message || "";
    feedback.classList.remove("is-error", "is-success");

    if (isError) {
      feedback.classList.add("is-error");
    } else if (message) {
      feedback.classList.add("is-success");
    }
  }

  function valueOrFallback(value) {
    if (!value) {
      return "-";
    }
    return String(value).trim() || "-";
  }

  function renderPreview() {
    var name = document.getElementById("name").value;
    var email = document.getElementById("email").value;
    var phone = document.getElementById("phone").value;
    var education = document.getElementById("education").value;
    var experience = document.getElementById("experience").value;
    var skills = document.getElementById("skills").value;
    var fileInput = document.getElementById("cvFile");

    document.getElementById("previewName").textContent = valueOrFallback(name);
    document.getElementById("previewEmail").textContent = valueOrFallback(email);
    document.getElementById("previewPhone").textContent = valueOrFallback(phone);
    document.getElementById("previewEducation").textContent = valueOrFallback(education);
    document.getElementById("previewExperience").textContent = valueOrFallback(experience);
    document.getElementById("previewSkills").textContent = valueOrFallback(skills);
    document.getElementById("previewFile").textContent =
      fileInput && fileInput.files && fileInput.files[0]
        ? fileInput.files[0].name
        : "-";

    previewContainer.hidden = false;
    hasPreview = true;

    if (submitButton) {
      submitButton.disabled = false;
    }

    setFeedback("Preview generated. You can now save your CV.", false);
  }

  function closePreview() {
    previewContainer.hidden = true;
  }

  function invalidatePreview() {
    hasPreview = false;
    previewContainer.hidden = true;
    if (submitButton) {
      submitButton.disabled = true;
    }
    if (feedback && feedback.classList.contains("is-success")) {
      setFeedback("Form changed. Generate preview again before saving.", true);
    }
  }

  if (submitButton) {
    submitButton.disabled = true;
  }

  if (phoneInput) {
    phoneInput.addEventListener("input", function () {
      phoneInput.value = phoneInput.value.replace(/\D+/g, "");
    });
  }

  previewBtn.addEventListener("click", function () {
    renderPreview();

    if (!form.checkValidity()) {
      setFeedback("Preview opened. Fill all required fields before saving.", true);
    }
  });

  if (closePreviewBtn) {
    closePreviewBtn.addEventListener("click", closePreview);
  }

  previewContainer.addEventListener("click", function (event) {
    if (event.target === previewContainer) {
      closePreview();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !previewContainer.hidden) {
      closePreview();
    }
  });

  form.querySelectorAll("input, textarea").forEach(function (field) {
    field.addEventListener("input", invalidatePreview);
    field.addEventListener("change", invalidatePreview);
  });

  form.addEventListener("submit", function (event) {
    if (!hasPreview) {
      event.preventDefault();
      setFeedback("Generate preview before saving your CV.", true);
      return;
    }

    event.preventDefault();
    setFeedback("CV passed preview step and is ready for API save.", false);
  });
})();
