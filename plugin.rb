# name: Online Users Sidebar
# about: Shows online users in a collapsible sidebar similar to Discord
# version: 1.0
# authors: Your Name
# url: https://github.com/your-repo/online-users-sidebar

enabled_site_setting :online_users_sidebar_enabled

register_asset "stylesheets/online-users-sidebar.scss"
register_asset "stylesheets/common/online-users-sidebar.scss"

register_component("online-users-sidebar")

after_initialize do
  load File.expand_path("../assets/javascripts/initializers/online-users-sidebar.js.es6", __FILE__)

  module ::OnlineUsersSidebar
    class Engine < ::Rails::Engine
      engine_name "online_users_sidebar"
      isolate_namespace OnlineUsersSidebar
    end
  end

  require_dependency "application_controller"

  class OnlineUsersSidebar::OnlineUsersController < ::ApplicationController
    requires_plugin "online-users-sidebar"

    def index
      # Get online threshold from settings
      online_threshold = SiteSetting.online_users_sidebar_online_threshold
      
      # Get online users (users active within the threshold)
      online_users = User.where("last_seen_at > ?", online_threshold.minutes.ago)
                         .where(staged: false)
                         .order("last_seen_at DESC")
      
      # Group users by their highest group
      grouped_users = {}
      
      online_users.each do |user|
        highest_group = user.groups.order("groups.name").first&.name || "Trust Level #{user.trust_level}"
        
        grouped_users[highest_group] ||= []
        grouped_users[highest_group] << {
          id: user.id,
          username: user.username,
          name: user.name,
          avatar_template: user.avatar_template,
          last_seen_at: user.last_seen_at
        }
      end

      render json: { grouped_users: grouped_users }
    end
  end

  OnlineUsersSidebar::Engine.routes.draw do
    get "/online_users" => "online_users#index"
  end

  Discourse::Application.routes.append do
    mount ::OnlineUsersSidebar::Engine, at: "/online-users-sidebar"
  end
end
