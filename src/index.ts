import { Server } from '@hapi/hapi'
import { applyToDefaults } from '@hapi/hoek'
import Joi from 'joi'

interface ApiVersionPluginOptions {
  version?: string
  prefix?: string
  enabled?: boolean
}

const defaultOptions: ApiVersionPluginOptions = {
  version: 'v1',
  prefix: 'api'
}

const optionsSchema = Joi.object({
  version: Joi.string().min(1).max(255).allow(''),
  prefix: Joi.string().min(1).max(255).allow(''),
  enabled: Joi.boolean().optional()
}).unknown(false)

const plugin = {
  name: 'apiv',
  register: async function (server: Server, options: ApiVersionPluginOptions = {}) {
    const { error, value } = optionsSchema.validate(options)

    if (error) {
      throw new Error(`Invalid plugin options: ${error.message}`)
    }

    const mergedOptions = applyToDefaults(defaultOptions, value)

    if (mergedOptions.enabled === false) {
      return
    }

    const parts: string[] = []

    if (mergedOptions.prefix) {
      parts.push(mergedOptions.prefix)
    }

    if (mergedOptions.version) {
      parts.push(mergedOptions.version)
    }

    const normalizedPrefix = parts.length ? '/' + parts.join('/') : ''

    let realm = server.realm as any
    while (realm.parent) {
      realm = realm.parent
    }

    const existing = realm.modifiers.route.prefix || ''
    const globalPrefix = normalizedPrefix || existing
    realm.modifiers.route.prefix = globalPrefix

    // Add alias routes for per-route overrides using options.plugins.apiv
    server.ext('onPreStart', () => {
      const routes = server.table()

      const stripGlobal = (path: string) => {
        if (!globalPrefix) {
          return path
        }

        if (path.startsWith(globalPrefix)) {
          const trimmed = path.slice(globalPrefix.length)
          return trimmed.length ? trimmed : '/'
        }
        return path
      }

      const buildVersionedPath = (originalPath: string, prefix?: string, version?: string) => {
        const segments: string[] = []
        if (prefix) {
          segments.push(prefix)
        }
        if (version) {
          segments.push(version)
        }

        const cleanPath = originalPath.startsWith('/') ? originalPath.slice(1) : originalPath
        if (cleanPath) {
          segments.push(cleanPath)
        }

        return '/' + segments.join('/').replaceAll(/\/+/g, '/')
      }

      for (const route of routes) {
        const routePlugins = (route.settings && (route.settings as any).plugins) || {}
        const apivConfig = routePlugins.apiv

        // Skip if no per-route config
        if (apivConfig === undefined) {
          continue
        }

        const originalPath = stripGlobal(route.path)

        // Disabled: create unprefixed alias
        if (apivConfig === false || apivConfig?.enabled === false) {
          server.route({ method: route.method, path: originalPath, handler: (route.settings as any).handler })
          continue
        }

        const hasPrefix = apivConfig && Object.hasOwn(apivConfig, 'prefix')
        const hasVersion = apivConfig && Object.hasOwn(apivConfig, 'version')

        const overridePrefix = hasPrefix ? apivConfig.prefix : mergedOptions.prefix
        const overrideVersion = hasVersion ? apivConfig.version : mergedOptions.version

        const aliasPath = buildVersionedPath(originalPath, overridePrefix, overrideVersion)

        if (aliasPath !== route.path) {
          server.route({ method: route.method, path: aliasPath, handler: (route.settings as any).handler })
        }
      }
    })
  }
}

export default plugin

export type { ApiVersionPluginOptions }
