import { resolve, basename, extname } from "node:path"
import { globSync } from "glob"
import { z } from "zod"
import { makeApi } from "@zodios/core"
export async function generateApis(options = {}) {
  const {
    routeFolder = process.env.npm_package_azoom_api_routeFolder || "routes",
  } = options
  const apiDefinitionConfigs = await prepareApiDefinitionConfig({ routeFolder })
  return makeApi(
    apiDefinitionConfigs.map((config) => ({
      response: z.object({}).optional(),
      ...config.apiDefinition,
      method: config.apiMethod,
      path: config.apiPath,
    }))
  )
}
function prepareApiDefinitionConfig({ routeFolder }) {
  const filePattern = "**/@(*.js)"
  const formattedRouteFolder = resolve(process.cwd(), routeFolder)
  return Promise.all(
    globSync(filePattern, { cwd: formattedRouteFolder })
      .filter((path) =>
        ["head", "options", "get", "post", "put", "patch", "delete"].includes(
          basename(path, extname(path)).toLowerCase()
        )
      )
      .map(async (path) => ({
        path,
        fullFilePath: `${formattedRouteFolder}/${path}`,
        apiPath: `/${path
          .replace(basename(path), "")
          .replace(/_/g, ":")
          .replace(/\/$/, "")}`,
        apiMethod: basename(path, extname(path)).toLowerCase(),
        apiDefinition:
          (await import(`${formattedRouteFolder}/${path}`))?.apiDefinition ||
          {},
      }))
  )
}
