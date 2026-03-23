(function () {
  var form = document.querySelector(".auth-form");
  if (!form) {
    return;
  }

  var feedback = document.querySelector(".form-feedback");
  var fields = Array.prototype.slice.call(form.querySelectorAll("input"));

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
      if (feedback) {
        feedback.textContent = "Please fix the highlighted fields and try again.";
      }
      firstInvalid.focus();
      return false;
    }

    if (feedback) {
      feedback.textContent = "Looks good. Form is ready to submit.";
    }

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

  form.addEventListener("submit", function (event) {
    if (!validateForm()) {
      event.preventDefault();
      return;
    }

    if (feedback) {
      feedback.textContent = "";
    }
  });
})();
