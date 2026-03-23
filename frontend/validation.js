(function () {
  var form = document.querySelector(".auth-form");
  if (!form) {
    return;
  }

  var API_BASE_URL = window.API_BASE_URL || "http://localhost:3000";
  var TOKEN_STORAGE_KEY = "jobseeker_jwt";
  var feedback = document.querySelector(".form-feedback");
  var fields = Array.prototype.slice.call(form.querySelectorAll("input"));
  var submitButton = form.querySelector("button[type='submit']");

  function setFeedback(message, type) {
    if (!feedback) {
      return;
    }

    feedback.textContent = message || "";
    feedback.classList.remove("is-error", "is-success");

    if (type === "error") {
      feedback.classList.add("is-error");
    }

    if (type === "success") {
      feedback.classList.add("is-success");
    }
  }

  function setSubmittingState(isSubmitting) {
    if (!submitButton) {
      return;
    }

    submitButton.disabled = isSubmitting;
    submitButton.textContent = isSubmitting
      ? "Please wait..."
      : form.id === "registrationForm"
        ? "Register"
        : "Login";
  }

  function saveToken(token) {
    if (!token) {
      return;
    }
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }

  async function apiPost(path, payload) {
    var response = await fetch(API_BASE_URL + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    var data;
    try {
      data = await response.json();
    } catch (error) {
      data = {};
    }

    if (!response.ok) {
      throw new Error(data.error || "Request failed. Please try again.");
    }

    return data;
  }

  async function handleLoginSubmit() {
    var email = document.getElementById("email").value.trim();
    var password = document.getElementById("password").value;

    var data = await apiPost("/api/auth/login", {
      email: email,
      password: password
    });

    if (!data.token) {
      throw new Error("Login succeeded but no token was returned.");
    }

    saveToken(data.token);
    setFeedback("Login successful. JWT saved in local storage.", "success");
  }

  async function handleRegistrationSubmit() {
    var email = document.getElementById("email").value.trim();
    var password = document.getElementById("password").value;
    var fullName = document.getElementById("fullName").value.trim();

    await apiPost("/api/auth/register", {
      email: email,
      password: password,
      name: fullName
    });

    // Automatically log in after successful registration so token storage is immediate.
    var loginData = await apiPost("/api/auth/login", {
      email: email,
      password: password
    });

    if (!loginData.token) {
      throw new Error("Registration succeeded but no login token was returned.");
    }

    saveToken(loginData.token);
    setFeedback("Registration successful. JWT saved in local storage.", "success");
  }

  function setFieldError(input, message) {
    var errorNode = document.getElementById(input.id + "Error");
    if (errorNode) {
      errorNode.textContent = message || "";
    }

    if (message) {
      input.classList.add("invalid");
      input.setAttribute("aria-invalid", "true");
    } else {
      input.classList.remove("invalid");
      input.removeAttribute("aria-invalid");
    }
  }

  function getErrorMessage(input) {
    if (input.validity.valueMissing) {
      return "This field is required.";
    }

    if (input.validity.typeMismatch && input.type === "email") {
      return "Please enter a valid email address.";
    }

    if (input.validity.tooShort) {
      return "Password must be at least 8 characters.";
    }

    if (input.id === "confirmPassword") {
      var password = document.getElementById("password");
      if (password && input.value !== password.value) {
        return "Passwords do not match.";
      }
    }

    return "";
  }

  function validateField(input) {
    if (input.id === "confirmPassword") {
      var password = document.getElementById("password");
      if (password && input.value && input.value !== password.value) {
        input.setCustomValidity("Passwords do not match.");
      } else {
        input.setCustomValidity("");
      }
    }

    var message = getErrorMessage(input);
    setFieldError(input, message);

    return !message;
  }

  function validateForm() {
    var firstInvalid = null;

    for (var i = 0; i < fields.length; i += 1) {
      var isValid = validateField(fields[i]);
      if (!isValid && !firstInvalid) {
        firstInvalid = fields[i];
      }
    }

    if (firstInvalid) {
      setFeedback("Please fix the highlighted fields and try again.", "error");
      firstInvalid.focus();
      return false;
    }

    setFeedback("", "");

    return true;
  }

  fields.forEach(function (input) {
    input.addEventListener("blur", function () {
      validateField(input);
    });

    input.addEventListener("input", function () {
      if (input.classList.contains("invalid") || input.id === "confirmPassword") {
        validateField(input);
      }
    });

    if (input.id === "password") {
      input.addEventListener("input", function () {
        var confirmPassword = document.getElementById("confirmPassword");
        if (confirmPassword && confirmPassword.value) {
          validateField(confirmPassword);
        }
      });
    }
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmittingState(true);

    try {
      if (form.id === "registrationForm") {
        await handleRegistrationSubmit();
      } else {
        await handleLoginSubmit();
      }
    } catch (error) {
      setFeedback(error.message, "error");
    } finally {
      setSubmittingState(false);
    }
  });
})();
