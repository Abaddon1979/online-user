import { withPluginApi } from "discourse/lib/plugin-api";

function initializeOnlineUsersSidebar(api) {
  const currentUser = api.getCurrentUser();
  
  // Only show sidebar to logged-in users
  if (!currentUser) return;

  // Add the sidebar component to the application
  api.onAppEvent("page:changed", () => {
    // Remove any existing sidebar
    const existingSidebar = document.querySelector(".online-users-sidebar");
    if (existingSidebar) {
      existingSidebar.remove();
    }

    // Add the sidebar component
    const sidebarContainer = document.createElement("div");
    sidebarContainer.id = "online-users-sidebar-container";
    document.body.appendChild(sidebarContainer);

    // Render the component
    api.renderInOutlet("online-users-sidebar-container", "online-users-sidebar");
  });
}

export default {
  name: "online-users-sidebar",

  initialize() {
    withPluginApi("1.6.0", initializeOnlineUsersSidebar);
  }
};
