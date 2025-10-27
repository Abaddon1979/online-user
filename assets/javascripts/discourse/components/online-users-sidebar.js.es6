import Component from "@ember/component";
import { service } from "@ember/service";
import { scheduleOnce } from "@ember/runloop";
import { computed } from "@ember/object";
import { ajax } from "discourse/lib/ajax";

export default Component.extend({
  siteSettings: service(),
  appEvents: service(),
  onlineUsers: null,
  loading: false,
  collapsed: true,

  init() {
    this._super(...arguments);
    this.set("onlineUsers", {});
    // State for custom usercard popover (anchored to username)
    this.setProperties({
      showCustomCard: false,
      customCardLoading: false,
      customCardData: null,
      customCardError: null,
      customCardGroups: null,
      customCardStyle: "",
      customCardAnchor: null,
      // Quick message + formatted join date/time
      quickMessageText: "",
      quickMessageError: null,
      customCardJoinDate: null,
      customCardJoinTime: null,
    });
    // Bind close/stop functions for popover
    this.closeCardFn = () => {
      this._closeCustomCard();
    };
    this.stopPropFn = (evt) => {
      try { evt?.stopPropagation?.(); } catch {}
    };

    // Quick message handlers (bound to preserve `this`)
    this.quickMessageInput = (evt) => {
      try {
        const v = evt?.target?.value ?? "";
        this.set("quickMessageText", v);
        this.set("quickMessageError", null);
      } catch {}
    };

    this.quickMessageKeydown = (evt) => {
      try {
        if (evt?.key === "Enter" && (evt.ctrlKey || evt.metaKey)) {
          evt.preventDefault?.();
          const uname = this.customCardData?.username;
          const text = (this.quickMessageText || "").trim();
          if (!uname || !text) {
            this.set("quickMessageError", "Enter a message to send.");
            return;
          }
          this._sendQuickMessage(uname, text);
        }
      } catch (e) {
        this.set("quickMessageError", "Failed to send (unexpected error)");
      }
    };

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

    // Bind a function used by {{on "click" this.toggleCollapseFn}} so `this` is the component
    this.toggleCollapseFn = () => {
      this.toggleProperty("collapsed");
      scheduleOnce("afterRender", this, this._updateBodyClass);
    };

    // Bind openUserCard function so `this` context is preserved
    this.openUserCardFn = (user, event) => {
      this._openUserCard(user, event);
    };
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
      const t = evt.target;
      const el = t && t.nodeType === 3 ? t.parentElement : t;
      const anchor = el?.closest?.('a[data-user-card], .user-name, .trigger-user-card');
      if (!anchor) {
        return;
      }
      // Prevent navigation and open the card instead
      evt.preventDefault();

      try {
        anchor.classList.add("trigger-user-card");
        const userFromData =
          anchor.getAttribute("data-user-card") ||
          anchor.dataset?.userCard ||
          anchor.dataset?.username;
        const username = userFromData || anchor.textContent?.trim();
        try { console.log("online-users-sidebar: click username resolved", { username, anchor }); } catch {}
        if (username && !anchor.getAttribute("data-user-card")) {
          anchor.setAttribute("data-user-card", username);
        }
        let usedCore = false;
        if (username) {
          try {
            if (window.ousShowUserCard) {
              window.ousShowUserCard(username, anchor);
              usedCore = true;
            }
          } catch (e3) {}
          if (!usedCore && typeof window.require === "function") {
            try {
              const candidates = [
                "discourse/lib/show-user-card",
                "discourse/lib/user-card",
                "discourse/lib/show-user",
                "discourse/widgets/user-card"
              ];
              for (let i = 0; i < candidates.length && !usedCore; i++) {
                try {
                  const mod = window.require(candidates[i]);
                  const fn =
                    mod?.showUser ||
                    mod?.show ||
                    mod?.open ||
                    mod?.default?.showUser ||
                    mod?.default?.show;
                  if (typeof fn === "function") {
                    try { console.log("online-users-sidebar: opening via module", candidates[i]); } catch {}
                    fn(username, anchor);
                    usedCore = true;
                    break;
                  }
                } catch (e5) {}
              }
            } catch (e4) {}
          }
        }
        if (usedCore) {
          return;
        }
        const ev1 = new MouseEvent("mouseenter", {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        anchor.dispatchEvent(ev1);
        const ev2 = new MouseEvent("mouseover", {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        anchor.dispatchEvent(ev2);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("online-users-sidebar: delegated user card open failed", e);
      }
    };
    // no custom click handler; using core user-link
    // this.element.addEventListener("click", this._ousClickHandler);
    // try { console.log("online-users-sidebar: bound click handler"); } catch {}
    try { console.log("online-users-sidebar: not binding click handler (using core user-link)"); } catch {}

    // Debug: listen for core card lifecycle events
    if (this.siteSettings?.online_user_debug && this.appEvents) {
      try {
        this._cardShowListener = function () {
          try { console.log("online-users-sidebar: appEvents card:show", arguments); } catch {}
        };
        this._cardShownListener = function () {
          try { console.log("online-users-sidebar: appEvents card:shown", arguments); } catch {}
        };
        this._cardHideListener = function () {
          try { console.log("online-users-sidebar: appEvents card:hide", arguments); } catch {}
        };
        this.appEvents.on("card:show", this, this._cardShowListener);
        this.appEvents.on("card:shown", this, this._cardShownListener);
        this.appEvents.on("card:hide", this, this._cardHideListener);
      } catch (e) {
        try { console.log("online-users-sidebar: failed to bind card debug listeners", e); } catch {}
      }
    }

    // When debug enabled, add body class and observe DOM for user-card
    if (this.siteSettings?.online_user_debug) {
      try { document.body.classList.add("ous-debug"); } catch {}
      try {
        const target = document.body;
        this._cardObserver = new MutationObserver((mutations) => {
          try {
            for (const m of mutations) {
              for (const node of m.addedNodes || []) {
                if (!(node instanceof HTMLElement)) { continue; }
                const card = node.matches?.(".user-card, .user-card-container, #user-card")
                  ? node
                  : node.querySelector?.(".user-card, .user-card-container, #user-card");
                if (card) {
                  const rect = card.getBoundingClientRect?.();
                  let style;
                  try { style = window.getComputedStyle(card); } catch {}
                  try { console.log("online-users-sidebar: detected user-card in DOM", { card, rect, style }); } catch {}
                }
              }
            }
          } catch {}
        });
        this._cardObserver.observe(target, { childList: true, subtree: true });
      } catch (e) {
        try { console.log("online-users-sidebar: card observer bind failed", e); } catch {}
      }
    }
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
    if (this.appEvents) {
      try {
        if (this._cardShowListener) this.appEvents.off("card:show", this, this._cardShowListener);
        if (this._cardShownListener) this.appEvents.off("card:shown", this, this._cardShownListener);
        if (this._cardHideListener) this.appEvents.off("card:hide", this, this._cardHideListener);
      } catch (e) {
        try { console.log("online-users-sidebar: failed to unbind card debug listeners", e); } catch {}
      }
      this._cardShowListener = this._cardShownListener = this._cardHideListener = null;
    }

    // Disconnect debug observer and remove debug class
    if (this._cardObserver) {
      try { this._cardObserver.disconnect(); } catch {}
      this._cardObserver = null;
    }
    if (this.siteSettings?.online_user_debug) {
      try { document.body.classList.remove("ous-debug"); } catch {}
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
  
  _openUserCard(user, event) {
    const debug = this.siteSettings?.online_user_debug;

    if (debug)
      console.log("online-users-sidebar: _openUserCard called", {
        user,
        event,
        thisContext: this,
        hasAppEvents: !!this.appEvents,
        hasSiteSettings: !!this.siteSettings,
      });

    // Prevent navigation to /u/username; open the user card via core hover behavior
    if (event && typeof event.preventDefault === "function") {
      event.preventDefault();
    }

    const anchor = event?.currentTarget || event?.target;
    if (!anchor) {
      if (debug) console.log("online-users-sidebar: no anchor found");
      return;
    }

    const uname = user?.username;
    if (!uname) {
      if (debug) console.log("online-users-sidebar: no username");
      return;
    }

    // Additional snapshot of site settings that can influence cards
    const ss = this.siteSettings || {};
    if (debug) {
      try {
        console.log("online-users-sidebar: site settings snapshot", {
          enable_user_cards: ss.enable_user_cards,
          login_required: ss.login_required,
          enable_user_directory: ss.enable_user_directory,
          user_card_background: ss.user_card_background,
        });
      } catch {}
    }

    // Ensure attributes for core handlers/positioning
    try {
      anchor.classList.add("trigger-user-card");
      if (!anchor.getAttribute("data-user-card")) {
        anchor.setAttribute("data-user-card", uname);
      }
    } catch {}

    if (debug) console.log("online-users-sidebar: username resolved", uname);

    // Custom usercard popover path
    if (this.siteSettings?.online_user_custom_card) {
      this._openCustomCard(uname, anchor);
      return;
    }

    // Helper: detect if a user card element appeared
    const isCardVisible = () => {
      try {
        const el =
          document.querySelector(".user-card") ||
          document.querySelector(".user-card-container") ||
          document.querySelector("#user-card");
        if (!el) return false;
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return (
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          rect.width > 0 &&
          rect.height > 0
        );
      } catch {
        return false;
      }
    };

    // Attempt 1: PluginAPI bridge (most reliable)
    const tryPluginApi = () => {
      try {
        if (window.ousShowUserCard) {
          if (debug) console.log("online-users-sidebar: trying ousShowUserCard");
          window.ousShowUserCard(uname, anchor);
          setTimeout(() => {
            if (isCardVisible()) {
              if (debug) console.log("online-users-sidebar: user card visible via ousShowUserCard");
              return;
            }
            if (debug) console.log("online-users-sidebar: ousShowUserCard did not show card, falling back to require()");
            tryRequire();
          }, 150);
          return true;
        } else if (debug) {
          console.log("online-users-sidebar: window.ousShowUserCard is not available");
        }
      } catch (e) {
        if (debug) console.log("online-users-sidebar: ousShowUserCard failed", e);
      }
      return false;
    };

    // Attempt 2: Require core module directly
    const tryRequire = () => {
      let used = false;
      try {
        if (typeof window.require === "function") {
          const candidates = [
            "discourse/lib/show-user-card",
            "discourse/lib/user-card",
            "discourse/lib/show-user",
            "discourse/widgets/user-card",
          ];
          for (let i = 0; i < candidates.length && !used; i++) {
            try {
              const mod = window.require(candidates[i]);
              const fn =
                mod?.showUser ||
                mod?.show ||
                mod?.open ||
                mod?.default?.showUser ||
                mod?.default?.show;
              if (typeof fn === "function") {
                if (debug) console.log("online-users-sidebar: opening via module", candidates[i]);
                fn(uname, anchor);
                used = true;
                break;
              }
            } catch {}
          }
        }
      } catch (e) {
        if (debug) console.log("online-users-sidebar: require fallback failed setup", e);
      }

      setTimeout(() => {
        if (isCardVisible()) {
          if (debug) console.log("online-users-sidebar: user card visible via require()");
          return;
        }
        if (debug) console.log("online-users-sidebar: require() did not show card, trying appEvents");
        tryAppEvents();
      }, 150);
    };

    // Attempt 3: appEvents with multiple payload signatures (to cover core variants)
    const tryAppEvents = () => {
      let fired = false;
      try {
        if (this.appEvents) {
          if (debug) console.log("online-users-sidebar: trying appEvents variants");

          // Variant A: object payload (newer)
          try {
            this.appEvents.trigger("card:show", {
              cardType: "user",
              username: uname,
              target: anchor,
            });
            fired = true;
          } catch {}

          // Variant B: explicit type + username + target
          try {
            this.appEvents.trigger("card:show", "user", uname, anchor);
            fired = true;
          } catch {}

          // Variant C: username + target
          try {
            this.appEvents.trigger("card:show", uname, anchor);
            fired = true;
          } catch {}

          // Variant D: alternate event names sometimes used by core/plugins
          try {
            this.appEvents.trigger("card:open", "user", uname, anchor);
            fired = true;
          } catch {}
          try {
            this.appEvents.trigger("user-card:show", uname, anchor);
            fired = true;
          } catch {}

          if (debug) console.log("online-users-sidebar: appEvents fired =", fired);
        } else if (debug) {
          console.log("online-users-sidebar: this.appEvents is not available");
        }
      } catch (e) {
        if (debug) console.log("online-users-sidebar: appEvents failed", e);
      }
      setTimeout(() => {
        if (isCardVisible()) {
          if (debug) console.log("online-users-sidebar: user card visible via appEvents");
          return;
        }
        if (debug) console.log("online-users-sidebar: appEvents did not show card, dispatching hover events");
        tryHoverEvents();
      }, 250);
    };

    // Attempt 4: Synthesize hover events as last resort
    const tryHoverEvents = () => {
      try {
        if (debug) console.log("online-users-sidebar: dispatching mouseenter/mouseover");
        const ev1 = new MouseEvent("mouseenter", {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        anchor.dispatchEvent(ev1);
        const ev2 = new MouseEvent("mouseover", {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        anchor.dispatchEvent(ev2);
      } catch (e) {
        if (debug) console.log("online-users-sidebar: hover dispatch failed", e);
      }
      setTimeout(() => {
        if (isCardVisible()) {
          if (debug) console.log("online-users-sidebar: user card visible via hover events");
        } else {
          if (debug) console.warn("online-users-sidebar: user card still not visible after all attempts; falling back to profile navigation");
          try {
            window.location.assign(`/u/${encodeURIComponent(uname)}`);
          } catch {}
        }
      }, 150);
    };

    // Start the chain with PluginAPI
    if (!tryPluginApi()) {
      // If plugin API not available, jump straight to require fallback
      tryRequire();
    }
  },

  _openCustomCard(username, anchor) {
    const debug = this.siteSettings?.online_user_debug;
    try { if (debug) console.log("online-users-sidebar: opening custom card", { username, anchor }); } catch {}

    this.setProperties({
      showCustomCard: true,
      customCardLoading: true,
      customCardError: null,
      customCardData: null,
      customCardGroups: null,
      customCardSummary: null,
      customCardBadges: null,
      customCardTLProgress: 0,
      customCardAnchor: anchor || null,
    });

    // ESC to close
    if (!this._escHandler) {
      this._escHandler = (e) => {
        if (e?.key === "Escape") {
          this._closeCustomCard();
        }
      };
      try { document.addEventListener("keydown", this._escHandler); } catch {}
    }

    // Outside click to close
    if (!this._docClickHandler) {
      this._docClickHandler = (e) => {
        try {
          const pop = document.querySelector(".ous-popover");
          if (!this.showCustomCard || !pop) return;
          if (pop.contains(e.target)) return;
          if (this.customCardAnchor && this.customCardAnchor.contains && this.customCardAnchor.contains(e.target)) return;
          this._closeCustomCard();
        } catch {}
      };
      try { document.addEventListener("mousedown", this._docClickHandler, true); } catch {}
    }

    // Position after render and on resize/scroll
    if (!this._repositionBound) {
      this._repositionBound = () => this._repositionCustomCard();
    }
    try {
      window.addEventListener("resize", this._repositionBound);
      window.addEventListener("scroll", this._repositionBound, true);
    } catch {}

    // Initial positioning
    try { scheduleOnce("afterRender", this, this._repositionCustomCard); } catch {}

    // Fetch user card data
    ajax(`/u/${encodeURIComponent(username)}/card.json`)
      .then((data) => {
        const user = data?.user || data;
        this.set("customCardData", user);
        // Fallback: if groups endpoint is restricted, prefer groups included in user card JSON
        try {
          if (!this.customCardGroups && user?.groups && user.groups.length) {
            this.set("customCardGroups", user.groups);
          }
        } catch {}

        // Format join date/time (MM-DD-YYYY and 12-hour time)
        try {
          const created = user?.created_at || user?.createdAt;
          if (created) {
            const d = new Date(created);
            const mm = String(d.getMonth() + 1).padStart(2, "0");
            const dd = String(d.getDate()).padStart(2, "0");
            const yyyy = d.getFullYear();
            const dateStr = `${mm}-${dd}-${yyyy}`;
            const timeStr = d.toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            });
            this.setProperties({
              customCardJoinDate: dateStr,
              customCardJoinTime: timeStr,
            });
          } else {
            this.setProperties({ customCardJoinDate: null, customCardJoinTime: null });
          }
        } catch {}
      })
      .catch((e) => {
        this.set("customCardError", e);
        try { console.error("online-users-sidebar: custom card fetch failed", e); } catch {}
      })
      .finally(() => {
        this.set("customCardLoading", false);
        try { scheduleOnce("afterRender", this, this._repositionCustomCard); } catch {}
      });

    // Fetch groups membership (best-effort)
    ajax(`/u/${encodeURIComponent(username)}/groups.json`)
      .then((g) => {
        const groups = g?.groups || g?.group_memberships || [];
        this.set("customCardGroups", groups);
      })
      .catch(() => {});

    // Fetch user summary (stats, badges, etc.)
    ajax(`/u/${encodeURIComponent(username)}/summary.json`)
      .then((summary) => {
        try {
          const badges = summary?.badges || summary?.user_badges || [];
          this.setProperties({
            customCardSummary: summary || null,
            customCardBadges: badges || [],
          });
          const tl = this.customCardData?.trust_level ?? summary?.user_summary?.trust_level ?? 0;
          const progress = Math.max(0, Math.min(100, Math.round((Number(tl) || 0) * 25)));
          this.set("customCardTLProgress", progress);
        } catch {}
      })
      .catch(() => {});
  },

  _closeCustomCard() {
    this.set("showCustomCard", false);
    if (this._escHandler) {
      try { document.removeEventListener("keydown", this._escHandler); } catch {}
      this._escHandler = null;
    }
    if (this._docClickHandler) {
      try { document.removeEventListener("mousedown", this._docClickHandler, true); } catch {}
      this._docClickHandler = null;
    }
    if (this._repositionBound) {
      try {
        window.removeEventListener("resize", this._repositionBound);
        window.removeEventListener("scroll", this._repositionBound, true);
      } catch {}
    }
    this._repositionBound = null;
    this.setProperties({
      customCardAnchor: null,
      customCardStyle: "",
      customCardSummary: null,
      customCardBadges: null,
      customCardTLProgress: 0,
      customCardGroups: null,
      customCardData: null,
    });
  },


  _sendQuickMessage(username, text) {
    // Send a PM using Discourse composer endpoint
    try {
      this.set("quickMessageError", null);
      ajax("/posts", {
        type: "POST",
        data: {
          archetype: "private_message",
          target_usernames: username,
          title: `Quick message to ${username}`,
          raw: text,
        },
      })
        .then(() => {
          this.set("quickMessageText", "");
        })
        .catch((e) => {
          try {
            // Prefer server-provided error; otherwise show generic
            const msg =
              e?.jqXHR?.responseJSON?.errors?.join?.(", ") ||
              e?.message ||
              "Failed to send message";
            this.set("quickMessageError", msg);
          } catch {
            this.set("quickMessageError", "Failed to send message");
          }
        });
    } catch {
      this.set("quickMessageError", "Failed to send (unexpected error)");
    }
  },

  _repositionCustomCard() {
    try {
      const anchor = this.customCardAnchor;
      if (!anchor) return;
      const pop = document.querySelector(".ous-popover");
      if (!pop) return;
      const rect = anchor.getBoundingClientRect();
      const popRect = pop.getBoundingClientRect();
      const margin = 8;
      const vw = window.innerWidth || document.documentElement.clientWidth;
      const vh = window.innerHeight || document.documentElement.clientHeight;

      let left = rect.right + margin;
      let top = rect.top;

      // If overflows to the right, place to the left of anchor
      if (left + popRect.width + margin > vw) {
        left = rect.left - popRect.width - margin;
      }
      // Clamp horizontally
      if (left < margin) left = margin;
      if (left + popRect.width + margin > vw) left = Math.max(margin, vw - popRect.width - margin);

      // Clamp vertically
      if (top + popRect.height + margin > vh) {
        top = Math.max(margin, vh - popRect.height - margin);
      }
      if (top < margin) top = margin;

      // Position fixed to viewport (no scroll offsets)
      const style = `top:${Math.round(top)}px;left:${Math.round(left)}px;`;
      this.set("customCardStyle", style);
    } catch {}
  },

  _overlayClick(evt) {
    this._closeCustomCard();
  },

  _stop(evt) {
    try { evt?.stopPropagation?.(); } catch {}
  },

  actions: {
    toggleCollapse() {
      this.toggleProperty("collapsed");
      scheduleOnce("afterRender", this, this._updateBodyClass);
    }
  }
});
