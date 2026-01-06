import { Server, type Plugin, type ReqRefDefaults, type RequestRoute } from '@hapi/hapi'
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

const plugin: Plugin<ApiVersionPluginOptions> = {
  name: 'apiv',
  register: async function (server: Server, options: ApiVersionPluginOptions = {}) {
    const { error, value } = optionsSchema.validate(options)

    if (error) {
      throw new Error(`Invalid plugin options: ${error.message}`)
    }

    const mergedOptions: ApiVersionPluginOptions = applyToDefaults(defaultOptions, value)

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

    const normalizedPrefix: string = parts.length ? '/' + parts.join('/') : ''

    let realm = server.realm as any
    while (realm.parent) {
      realm = realm.parent
    }

    const existing: string = realm.modifiers.route.prefix || ''
    const globalPrefix: string = normalizedPrefix || existing
    realm.modifiers.route.prefix = globalPrefix

    const extractRouteOptions = (settings: any) => {
      const options: any = {}

      const propsToCopy = [
        'auth', 'bind', 'description', 'id', 'isInternal', 'notes', 'tags'
      ]

      for (const prop of propsToCopy) {
        if (settings[prop] !== undefined && settings[prop] !== null) {
          options[prop] = settings[prop]
        }
      }

      if (settings.cors && settings.cors !== false) {
        options.cors = settings.cors
      }

      if (settings.compression && Object.keys(settings.compression).length > 0) {
        options.compression = settings.compression
      }

      if (settings.jsonp && settings.jsonp !== null) {
        options.jsonp = settings.jsonp
      }

      if (settings.payload && settings.payload !== null) {
        options.payload = settings.payload
      }

      if (settings.response && settings.response.schema !== undefined) {
        options.response = settings.response
      }

      if (settings.security && settings.security !== null) {
        options.security = settings.security
      }

      if (settings.timeout && (settings.timeout.server !== false || settings.timeout.socket !== undefined)) {
        options.timeout = settings.timeout
      }

      if (settings.validate) {
        const hasValidators = settings.validate.payload || settings.validate.params ||
          settings.validate.query || settings.validate.headers || settings.validate.state
        if (hasValidators) {
          options.validate = settings.validate
        }
      }

      return options
    }

    server.ext('onPreStart', () => {
      const routes: RequestRoute<ReqRefDefaults>[] = server.table()

      const stripGlobal = (path: string): string => {
        if (!globalPrefix) {
          return path
        }

        if (path.startsWith(globalPrefix)) {
          const trimmed: string = path.slice(globalPrefix.length)
          return trimmed.length ? trimmed : '/'
        }
        return path
      }

      const buildVersionedPath = (originalPath: string, prefix?: string, version?: string): string => {
        const segments: string[] = []

        if (prefix) {
          segments.push(prefix)
        }

        if (version) {
          segments.push(version)
        }

        const cleanPath: string = originalPath.startsWith('/') ? originalPath.slice(1) : originalPath

        if (cleanPath) {
          segments.push(cleanPath)
        }

        return '/' + segments.join('/').replaceAll(/\/+/g, '/')
      }

      for (const route of routes) {
        const routePlugins = (route.settings && (route.settings as any).plugins) || {}
        const apivConfig = routePlugins.apiv

        if (apivConfig === undefined) {
          continue
        }

        const originalPath: string = stripGlobal(route.path)

        if (apivConfig === false || apivConfig?.enabled === false) {
          const routeOptions = extractRouteOptions(route.settings)
          server.route({ method: route.method, path: originalPath, handler: route.settings.handler, options: routeOptions })
          continue
        }

        const hasPrefix: boolean = apivConfig && Object.hasOwn(apivConfig, 'prefix')
        const hasVersion: boolean = apivConfig && Object.hasOwn(apivConfig, 'version')

        const overridePrefix: string = hasPrefix ? apivConfig.prefix : mergedOptions.prefix
        const overrideVersion: string = hasVersion ? apivConfig.version : mergedOptions.version

        const aliasPath: string = buildVersionedPath(originalPath, overridePrefix, overrideVersion)

        if (aliasPath !== route.path) {
          const routeOptions = extractRouteOptions(route.settings)
          server.route({ method: route.method, path: aliasPath, handler: route.settings.handler, options: routeOptions })
        }
      }
    })
  }
}

export default plugin

export type { ApiVersionPluginOptions }
