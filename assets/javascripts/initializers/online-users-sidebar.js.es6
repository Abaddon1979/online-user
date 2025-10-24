import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "online-users-sidebar",

  initialize() {
    withPluginApi("1.6.0", (api) => {
      // Rendering is handled via the plugin outlet connector:
      // assets/javascripts/discourse/connectors/below-site-header/online-users-sidebar.hbs
      // This initializer intentionally does not render anything.
    });
  }
};
