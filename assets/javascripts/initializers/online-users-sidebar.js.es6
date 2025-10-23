import { withPluginApi } from "discourse/lib/plugin-api";

function initializeOnlineUsersSidebar(api) {
  const currentUser = api.getCurrentUser();
  
  // Only show sidebar to logged-in users
  if (!currentUser) return;

  // Use the standard Discourse approach for adding UI elements
  api.addSidebarPanel("online-users-sidebar-panel", {
    header: "Online Users",
    hidden: false,
    
    setupPanel(element) {
      // Create the component and append it to the panel
      const component = api.container.lookup("component:online-users-sidebar");
      if (component) {
        component.appendTo(element);
      }
    },
    
    teardownPanel() {
      // Cleanup when panel is removed
      const component = api.container.lookup("component:online-users-sidebar");
      if (component) {
        component.destroy();
      }
    }
  });
}

export default {
  name: "online-users-sidebar",

  initialize() {
    withPluginApi("1.6.0", initializeOnlineUsersSidebar);
  }
};
