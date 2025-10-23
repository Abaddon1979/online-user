# Online Users Sidebar Plugin for Discourse

A Discourse plugin that displays online users in a collapsible sidebar similar to Discord, showing users grouped by their highest role/trust level.

## Features

- **Collapsible Sidebar**: Starts collapsed by default, can be expanded with a single click
- **Real-time Updates**: Automatically refreshes every 30 seconds to show current online users
- **Group-based Organization**: Users are grouped by their highest role (Admin, Moderator, Trust Level 4, etc.)
- **Discord-like Interface**: Clean, modern interface that matches Discourse's design
- **Mobile Responsive**: Adapts to different screen sizes
- **Configurable Settings**: Multiple settings to customize behavior

## Installation

1. Add the plugin to your Discourse installation:
   ```bash
   cd /var/discourse
   ./launcher enter app
   cd /var/www/discourse
   git clone https://github.com/your-repo/online-users-sidebar plugins/online-users-sidebar
   ```

2. Rebuild Discourse:
   ```bash
   ./launcher rebuild app
   ```

## Configuration

The plugin includes several configurable settings:

- **Refresh Interval**: How often to refresh the online users list (10-300 seconds)
- **Online Threshold**: How many minutes since last seen to consider a user online (1-60 minutes)
- **Start Collapsed**: Whether the sidebar should start collapsed
- **Show Avatars**: Whether to display user avatars
- **Sidebar Width**: Width of the sidebar in pixels (200-400px)

## How It Works

1. The plugin creates a fixed sidebar on the right-hand side of the screen
2. It queries the server every 30 seconds for users active within the last 5 minutes (configurable)
3. Users are grouped by their highest role/trust level:
   - Admins
   - Moderators
   - Trust Level 4
   - Trust Level 3
   - Trust Level 2
   - Trust Level 1
   - Trust Level 0
4. The sidebar can be collapsed/expanded by clicking the header

## Technical Details

- **Backend**: Ruby on Rails controller that provides online user data via JSON API
- **Frontend**: Ember.js component with real-time updates
- **Styling**: SCSS with Discourse theme variables for consistent theming
- **Performance**: Efficient queries and client-side caching

## File Structure

```
online-users-sidebar/
├── plugin.rb                 # Main plugin file
├── config/
│   └── settings.yml          # Plugin settings
├── assets/
│   ├── javascripts/
│   │   ├── discourse/
│   │   │   ├── components/
│   │   │   │   └── online-users-sidebar.js.es6
│   │   │   └── templates/
│   │   │       └── components/
│   │   │           └── online-users-sidebar.hbs
│   │   └── initializers/
│   │       └── online-users-sidebar.js.es6
│   └── stylesheets/
│       └── online-users-sidebar.scss
└── README.md
```

## Compatibility

- Discourse 2.8.0 or higher
- Ember.js 3.28 or higher

## License

MIT License

## Support

For issues and feature requests, please create an issue in the GitHub repository.
