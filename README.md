# Apiv

A Hapi.js plugin that automatically adds version prefixes to all your API routes, making it easy to version your API endpoints.

## Installation

```bash
npm install apiv
```

## Features

- Automatically prefixes all routes with a version and/or API prefix
- Global configuration applies to all routes
- Simple setup with sensible defaults
- Supports custom prefixes and version strings
- Can be disabled globally when needed
- TypeScript support included

## Usage

### Basic Example

By default, the plugin prefixes all routes with `/api/v1`:

```javascript
import Hapi from '@hapi/hapi'
import apiv from 'apiv'

const server = Hapi.server({ port: 3000 })

await server.register({ plugin: apiv })

server.route({
  method: 'GET',
  path: '/users',
  handler: () => ({ users: [] })
})

await server.start()
// Route is now accessible at: GET /api/v1/users
```

### Custom Version and Prefix

You can customize both the version and prefix:

```javascript
await server.register({
  plugin: apiv,
  options: {
    version: 'v2',
    prefix: 'service'
  }
})

server.route({
  method: 'GET',
  path: '/users',
  handler: () => ({ users: [] })
})
// Route is now accessible at: GET /service/v2/users
```

### Empty Prefix or Version

You can set either option to an empty string to exclude it:

```javascript
// Only version, no prefix
await server.register({
  plugin: apiv,
  options: {
    prefix: '',
    version: 'v1'
  }
})
// Routes accessible at: GET /v1/users

// Only prefix, no version
await server.register({
  plugin: apiv,
  options: {
    prefix: 'api',
    version: ''
  }
})
// Routes accessible at: GET /api/users

// Neither (routes unchanged)
await server.register({
  plugin: apiv,
  options: {
    prefix: '',
    version: ''
  }
})
// Routes accessible at: GET /users
```

### Disabling the Plugin

You can disable the plugin entirely by setting `enabled: false`:

```javascript
await server.register({
  plugin: apiv,
  options: { enabled: false }
})

server.route({
  method: 'GET',
  path: '/users',
  handler: () => ({ users: [] })
})
// Route remains at: GET /users (no prefix applied)
```

## Configuration

### Global Options

All configuration is done at the plugin registration level:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `version` | `string` | `'v1'` | Version string to prepend to routes (max 255 chars) |
| `prefix` | `string` | `'api'` | Prefix string to prepend before version (max 255 chars) |
| `enabled` | `boolean` | `true` | Whether to enable the plugin |

### Important Notes

- **No Per-Route Overrides**: This plugin applies globally to all routes. Route-level configuration via `options.plugins.apiv` is **not supported** and will be ignored.
- **Global Configuration Only**: All routes registered after the plugin will receive the same prefix and version.
- **Cannot Disable Per-Route**: Once the plugin is registered with `enabled: true` (the default), all routes will be prefixed. There is no way to exclude individual routes.

## Examples

### Multiple Versions on Same Server

If you need to support multiple API versions, you can register separate server instances or use different plugins:

```javascript
// All routes get v1 prefix
await server.register({
  plugin: apiv,
  options: { version: 'v1' }
})

server.route({
  method: 'GET',
  path: '/users',
  handler: () => ({ version: 1 })
})
// Accessible at: GET /api/v1/users
```

### Nested Paths

The plugin works with any route path structure:

```javascript
server.route({
  method: 'GET',
  path: '/users/{id}/posts',
  handler: () => ({ posts: [] })
})
// Accessible at: GET /api/v1/users/{id}/posts
```

### Root Path

Even the root path gets prefixed:

```javascript
server.route({
  method: 'GET',
  path: '/',
  handler: () => ({ message: 'API Root' })
})
// Accessible at: GET /api/v1
```

## TypeScript

The plugin includes TypeScript definitions:

```typescript
import { Server } from '@hapi/hapi'
import apiv, { ApiVersionPluginOptions } from 'apiv'

const server: Server = Hapi.server({ port: 3000 })

const options: ApiVersionPluginOptions = {
  version: 'v2',
  prefix: 'api',
  enabled: true
}

await server.register({ plugin: apiv, options })
```

## License

MIT
