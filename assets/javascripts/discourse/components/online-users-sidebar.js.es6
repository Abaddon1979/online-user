import Component from "@ember/component";
import { service } from "@ember/service";
import { scheduleOnce } from "@ember/runloop";
import { computed } from "@ember/object";
import ajax from "discourse/lib/ajax";

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

    this.loadOnlineUsers();
    
    // Set up periodic refresh using site setting (seconds)
    const intervalSec = this.siteSettings?.online_user_refresh_interval || 30;
    this.refreshInterval = setInterval(() => {
      this.loadOnlineUsers();
    }, intervalSec * 1000);
  },

  willDestroyElement() {
    this._super(...arguments);
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  },

  loadOnlineUsers() {
    if (this.loading) return;
    
    this.set("loading", true);
    
    ajax("/online-users-sidebar/online_users")
      .then((data) => {
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
  
  actions: {
    toggleCollapse() {
      this.toggleProperty("collapsed");
    }
  }
});
