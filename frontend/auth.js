(function () {
  var TOKEN_KEY = "jobseeker_jwt";
  var API_BASE_URL = window.API_BASE_URL || "http://localhost:3000";

  window.AppAuth = {
    TOKEN_KEY: TOKEN_KEY,

    getToken: function () {
      return localStorage.getItem(TOKEN_KEY);
    },

    requireAuth: function () {
      if (!localStorage.getItem(TOKEN_KEY)) {
        window.location.replace("login.html");
        return false;
      }
      return true;
    },

    logout: function () {
      var token = localStorage.getItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_KEY);
      if (token) {
        fetch(API_BASE_URL + "/api/auth/logout", {
          method: "POST",
          headers: { Authorization: "Bearer " + token }
        }).catch(function () {});
      }
      window.location.href = "login.html";
    }
  };
})();
