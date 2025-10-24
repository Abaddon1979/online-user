import Component from "@ember/component";
import { service } from "@ember/service";
import { scheduleOnce } from "@ember/runloop";
import { computed } from "@ember/object";
import { ajax } from "discourse/lib/ajax";

export default Component.extend({
  siteSettings: service(),
  onlineUsers: null,
  loading: false,
  collapsed: true,

  init() {
    this._super(...arguments);
    this.set("onlineUsers", {});
    // Respect site setting for initial collapsed state
    this.set("collapsed", !!this.siteSettings?.online_user_start_collapsed);
    // eslint-disable-next-line no-console
    console.log("online-users-sidebar: component init", {
      collapsed: this.collapsed,
      refresh: this.siteSettings?.online_user_refresh_interval,
      width: this.siteSettings?.online_user_sidebar_width,
    });

    this.loadOnlineUsers();
    
    // Set up periodic refresh using site setting (seconds)
    const intervalSec = this.siteSettings?.online_user_refresh_interval || 30;
    this.refreshInterval = setInterval(() => {
      this.loadOnlineUsers();
    }, intervalSec * 1000);
  },

  didInsertElement() {
    this._super(...arguments);
    // eslint-disable-next-line no-console
    console.log("online-users-sidebar: didInsertElement");
    scheduleOnce("afterRender", this, this._updateBodyClass);

    // If chat is currently open, start collapsed but do not enforce continuously
    if (this.isChatOpen() && !this.collapsed) {
      this.set("collapsed", true);
      scheduleOnce("afterRender", this, this._updateBodyClass);
    }

    // Delegate clicks on usernames to open the core user card anchored to the link
    this._ousClickHandler = (evt) => {
      const anchor = evt.target?.closest?.(".user-name, .trigger-user-card");
      if (!anchor) {
        return;
      }
      // Prevent navigation and open the card instead
      evt.preventDefault();
      evt.stopPropagation?.();

      try {
        anchor.classList.add("trigger-user-card");
        const userFromData =
          anchor.getAttribute("data-user-card") ||
          anchor.dataset?.userCard ||
          anchor.dataset?.username;
        const username = userFromData || anchor.textContent?.trim();
        if (username && !anchor.getAttribute("data-user-card")) {
          anchor.setAttribute("data-user-card", username);
        }
        const ev = new MouseEvent("mouseenter", {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        anchor.dispatchEvent(ev);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("online-users-sidebar: delegated user card open failed", e);
      }
    };
    this.element.addEventListener("click", this._ousClickHandler);
  },

  willDestroyElement() {
    this._super(...arguments);
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    if (this._ousClickHandler) {
      try {
        this.element?.removeEventListener("click", this._ousClickHandler);
      } catch {}
      this._ousClickHandler = null;
    }
    try {
      document.body.classList.remove("online-users-sidebar-open");
      if (document?.documentElement?.style?.setProperty) {
        document.documentElement.style.setProperty("--ous-width", null);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("online-users-sidebar: cleanup failed", e);
    }
  },

  loadOnlineUsers() {
    if (this.loading) return;
    
    this.set("loading", true);
    
    ajax("/online-users-sidebar/online_users.json")
      .then((data) => {
        // eslint-disable-next-line no-console
        console.log("online-users-sidebar: fetched", data);
        this.set("onlineUsers", data.grouped_users || {});
      })
      .catch((e) => {
        // Log and continue; we'll try again on next refresh
        // eslint-disable-next-line no-console
        console.error("online-users-sidebar: failed to load users", e);
      })
      .finally(() => {
        scheduleOnce("afterRender", this, () => {
          this.set("loading", false);
        });
      });
  },

  sortedGroups: computed("onlineUsers", function() {
    const onlineUsers = this.onlineUsers || {};

    const orderFor = (name) => {
      const n = (name || "").toString().toLowerCase().replace(/[\s-]+/g, "_");
      if (n === "admins" || n === "admin") return 1;
      if (n === "moderators" || n === "moderator") return 2;
      const m = n.match(/^trust_?level_?(\d)/);
      if (m) {
        const lvl = parseInt(m[1], 10);
        // TL4 first, TL0 last
        return 3 + (4 - Math.min(Math.max(lvl, 0), 4));
      }
      return 999;
    };

    const displayFor = (name) => {
      const raw = (name || "").toString();
      const ln = raw.toLowerCase().replace(/[\s-]+/g, "_");
      if (ln.includes("admin")) return "Admin";
      if (ln.includes("moderator")) return "Moderator";
      const m = ln.match(/trust_?level_?(\d)/);
      if (m) return `Trust Level ${m[1]}`;
      return raw;
    };

    return Object.keys(onlineUsers)
      .sort((a, b) => orderFor(a) - orderFor(b))
      .map((key) => {
        return {
          key,
          displayName: displayFor(key),
          users: onlineUsers[key] || [],
        };
      });
  }),
  
  sidebarWidth: computed("siteSettings.online_user_sidebar_width", function() {
    const w = this.siteSettings?.online_user_sidebar_width;
    return typeof w === "number" && w > 0 ? w : 240;
  }),
  
  totalOnlineCount: computed("onlineUsers", function() {
    const onlineUsers = this.onlineUsers || {};
    let total = 0;
    Object.values(onlineUsers).forEach((arr) => {
      if (Array.isArray(arr)) {
        total += arr.length;
      }
    });
    return total;
  }),
  
  isChatOpen() {
    const path = window.location?.pathname || "";
    if (path.startsWith("/chat")) return true;
    return (
      document.body?.classList?.contains("has-full-page-chat") ||
      document.querySelector(".chat-app, .chat-fullscreen, #chat-container, .chat-drawer")
    );
  },
  
  _updateBodyClass() {
    try {
      const open = !this.collapsed;
      const body = document.body;
      if (open) {
        body.classList.add("online-users-sidebar-open");
      } else {
        body.classList.remove("online-users-sidebar-open");
      }
      const width = this.get("sidebarWidth");
      if (document?.documentElement?.style?.setProperty) {
        document.documentElement.style.setProperty("--ous-width", `${width}px`);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("online-users-sidebar: failed to update layout state", e);
    }
  },
  
  actions: {
    toggleCollapse() {
      this.toggleProperty("collapsed");
      scheduleOnce("afterRender", this, this._updateBodyClass);
    },

    openUserCard(user, event) {
      // Prevent navigation to /u/username; open the user card via core hover behavior
      if (event && typeof event.preventDefault === "function") {
        event.preventDefault();
        event.stopPropagation?.();
      }

      const anchor = event?.currentTarget || event?.target;
      if (!anchor) {
        return;
      }

      // Ensure trigger attributes and dispatch a synthetic hover to open the card
      try {
        anchor.classList.add("trigger-user-card");
        if (!anchor.getAttribute("data-user-card") && user?.username) {
          anchor.setAttribute("data-user-card", user.username);
        }
        const ev = new MouseEvent("mouseenter", { bubbles: true, cancelable: true, view: window });
        anchor.dispatchEvent(ev);
      } catch (e2) {
        // eslint-disable-next-line no-console
        console.warn("online-users-sidebar: user card open failed", e2);
      }
    }
  }
});
