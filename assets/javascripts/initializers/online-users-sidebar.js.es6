import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "online-users-sidebar-init",

  initialize() {
    withPluginApi("0.1", (api) => {
      // Attach core user-card behavior to our sidebar container (safe if method exists)
      try {
        api.attachUserCard?.(".ous-sidebar");
      } catch (e) {}

      // Expose a global helper so the component can call the core API directly
      try {
        window.ousShowUserCard = function (username, target) {
          try {
            api.showUserCard?.(username, target);
          } catch (e2) {
            // no-op fallback, component will synthesize hover events
          }
        };
      } catch (e) {}

    });
  }
};
