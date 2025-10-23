import Component from "@ember/component";
import { inject as service } from "@ember/service";
import { scheduleOnce } from "@ember/runloop";
import { computed } from "@ember/object";

export default Component.extend({
  ajax: service(),
  onlineUsers: null,
  loading: false,
  collapsed: false,

  init() {
    this._super(...arguments);
    this.set("onlineUsers", {});
    this.loadOnlineUsers();
    
    // Set up periodic refresh every 30 seconds
    this.refreshInterval = setInterval(() => {
      this.loadOnlineUsers();
    }, 30000);
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
    
    this.ajax.request("/online-users-sidebar/online_users")
      .then((data) => {
        this.set("onlineUsers", data.grouped_users || {});
      })
      .catch(() => {
        // Silently fail - we'll try again on next refresh
      })
      .finally(() => {
        scheduleOnce("afterRender", this, () => {
          this.set("loading", false);
        });
      });
  },

  getSortedGroups: computed('onlineUsers', function() {
    const groups = Object.keys(this.onlineUsers || {});
    return groups.sort((a, b) => {
      const orderA = this.getGroupOrder(a);
      const orderB = this.getGroupOrder(b);
      return orderA - orderB;
    });
  }),

  actions: {
    toggleCollapse() {
      this.toggleProperty("collapsed");
    },

    getGroupDisplayName(groupName) {
      // Convert group names to more display-friendly format
      const groupMap = {
        "admins": "Admin",
        "moderators": "Moderator",
        "trust_level_4": "Trust Level 4",
        "trust_level_3": "Trust Level 3",
        "trust_level_2": "Trust Level 2",
        "trust_level_1": "Trust Level 1",
        "trust_level_0": "Trust Level 0"
      };
      
      return groupMap[groupName.toLowerCase()] || groupName;
    },

    getGroupOrder(groupName) {
      // Define the order of groups for sorting
      const groupOrder = {
        "admins": 1,
        "moderators": 2,
        "trust_level_4": 3,
        "trust_level_3": 4,
        "trust_level_2": 5,
        "trust_level_1": 6,
        "trust_level_0": 7
      };
      
      return groupOrder[groupName.toLowerCase()] || 999;
    }
  }
});
