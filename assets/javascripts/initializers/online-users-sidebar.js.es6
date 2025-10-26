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
          // Prefer PluginAPI if available
          try {
            if (api?.showUserCard) {
              api.showUserCard(username, target);
              return;
            }
          } catch (e2) {}

          // Fallback to require()-based modules
          try {
            if (typeof window.require === "function") {
              const candidates = [
                "discourse/lib/show-user-card",
                "discourse/lib/user-card",
                "discourse/lib/show-user",
                "discourse/widgets/user-card"
              ];
              for (let i = 0; i < candidates.length; i++) {
                try {
                  const mod = window.require(candidates[i]);
                  const fn =
                    mod?.showUser ||
                    mod?.show ||
                    mod?.open ||
                    mod?.default?.showUser ||
                    mod?.default?.show;
                  if (typeof fn === "function") {
                    fn(username, target);
                    return;
                  }
                } catch (e4) {}
              }
            }
          } catch (e3) {}

          // If nothing worked, component will synthesize hover events
        };
      } catch (e) {}

    });
  }
};
