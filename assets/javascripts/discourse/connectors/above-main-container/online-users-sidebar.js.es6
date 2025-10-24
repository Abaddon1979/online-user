import { getOwner } from "@ember/application";

export default {
  shouldRender(args, component) {
    const owner = getOwner(component);

    // Gate on site setting
    const siteSettings = owner.lookup("service:site-settings");
    if (!siteSettings?.online_user_enabled) {
      return false;
    }

    // Only for logged-in users
    const currentUserService = owner.lookup("service:current-user");
    if (!currentUserService?.currentUser) {
      return false;
    }

    // Avoid chat routes where header/layout differs and any pages without a site header
    const router = owner.lookup("service:router");
    const routeName = router?.currentRouteName || "";
    const rn = (routeName && routeName.toLowerCase ? routeName.toLowerCase() : "");
    if (
      rn.startsWith("chat") ||
      rn.includes("discourse_chat") ||
      rn.includes("chat.")
    ) {
      return false;
    }

    // Also block on chat by URL or DOM signals
    const path = window.location?.pathname || "";
    if (
      path.startsWith("/chat") ||
      document.body?.classList?.contains("has-full-page-chat") ||
      document.querySelector(".chat-app, .chat-fullscreen, #chat-container")
    ) {
      return false;
    }

    // Skip if there is no header element present to avoid core header offset errors
    if (!document.querySelector(".d-header")) {
      return false;
    }

    return true;
  },
};
