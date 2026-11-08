(function () {
  "use strict";

  var storageKey = "dark";
  var root = document.documentElement;
  var button = document.querySelector("[data-theme-toggle]");

  function isDark() {
    return root.classList.contains("dark");
  }

  function syncButton() {
    if (!button) return;
    var dark = isDark();
    button.setAttribute("aria-pressed", dark ? "true" : "false");
    button.setAttribute(
      "aria-label",
      dark ? "Switch to light theme" : "Switch to dark theme"
    );
  }

  function setDark(dark) {
    root.classList.toggle("dark", dark);
    try {
      localStorage.setItem(storageKey, dark ? "true" : "false");
    } catch (err) {
      /* ignore quota / private mode */
    }
    syncButton();
  }

  syncButton();

  if (button) {
    button.addEventListener("click", function () {
      setDark(!isDark());
    });
  }
})();
