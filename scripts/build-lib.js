import { writeFile, readFile, readdir, stat } from "node:fs/promises"
import { promisify } from "node:util"
import { exec } from "node:child_process"
import {
  resolve,
  join,
  parse,
  dirname,
  relative,
  basename,
  extname,
} from "node:path"
import * as process from "process"
import * as url from "url"
import ts from "typescript"
import { globSync } from "glob"
import { Command } from "commander"
import { z } from "zod"
import * as ZodSchema from "../@zod-schema"
const pExec = promisify(exec)
const __dirname = url.fileURLToPath(new URL(".", import.meta.url))
const ConfigSchema = z.object({
  projectFolder: z.string(),
  outputFolder: z.string(),
  tsConfigFile: z.string(),
  routeFolder: z.string(),
  schemaFolder: z.string(),
  publishName: z.string(),
  publishVersion: z.string(),
  publishRepository: z.string(),
  additionalFiles: z.array(z.string()),
  projectPackageJson: z.any(),
})
const ConfigSchemaPartial = ConfigSchema.partial()
buildLib()
export async function buildLib() {
  const packageFile = JSON.parse(await readFile("package.json", "utf-8"))
  const publishVersion = packageFile.version

  const config = {
    outputFolder: "dist",
    publishName: "demo-zod-api",
    publishVersion,
    publishRepository: "git@github.com:azoom-dang-van-hoi/demo-zod-api.git",
    routeFolder: "routes",
    zodSchemaFolder: "@zod-schema",
  }
  await ensureOutputFolder(config.outputFolder)
  await generateLibPackageJsonFile(config)
  await generateZodSchemaFolder({
    routeFolder: config.zodSchemaFolder,
    outputFolder: `${config.outputFolder}/${config.zodSchemaFolder}`,
  })
  const apiDefinitionConfigs = await prepareApiDefinitionConfig(
    config.routeFolder
  )
  const apiDefinitions = await formatApiDefinitions(apiDefinitionConfigs)
  const apiDefinitionString = extractApiDefinitionString(apiDefinitions)
  await writeFile(
    "dist/index.js",
    `
import { makeErrors, makeApi } from "@zodios/core"
import { ${Object.keys(ZodSchema).join(",")} } from "./@zod-schema"
import z from "zod"
export const apiClient = makeApi([${apiDefinitionString}])
`,
    "utf8"
  )
}
async function ensureOutputFolder(outputFolder) {
  await pExec(`mkdir -p ${outputFolder} || true`)
}

function copy(target, destination) {
  const destinationFolder = dirname(destination)
  return pExec(
    `mkdir -p ${destinationFolder} || true && cp -r ${target} ${destination}`
  )
}

async function generateLibPackageJsonFile(config) {
  const {
    outputFolder,
    publishName,
    publishVersion,
    publishRepository,
    projectPackageJson,
  } = config
  const pkgJsonFilePath = resolve(outputFolder, "package.json")
  const packageRepositionString = publishRepository
    ? `"repository": "${publishRepository}",`
    : ""
  await writeFile(
    pkgJsonFilePath,
    `
  {
    "name": "@dangvanhoi/${publishName}",
    "version": "${publishVersion}",
    "description": "Utils for ${publishName}",
    "author": "azoom-dang-van-hoi <dang.van.hoi@azoom.jp>",
    "license": "MIT",
    "main": "index.js",
    "repository": {
      "type": "git",
      "url": "${publishRepository}"
    },
    "type": "module",
    "dependencies": {
      "@zodios/core": "${
        projectPackageJson?.dependencies["@zodios/core"] || "^10.7.7"
      }",
      "zod": "${projectPackageJson?.dependencies["zod"] || "3.21.1"}"
    }
  }
  `
  )
}
async function generateZodSchemaFolder({ routeFolder, outputFolder }) {
  const filePattern = "**/@(*.js)"
  const formattedRouteFolder = resolve(process.cwd(), routeFolder)
  const formattedOutputFolder = resolve(process.cwd(), outputFolder)
  await pExec(
    `mkdir -p ${outputFolder} || true && cp -r ${formattedRouteFolder} dist`
  )
  await Promise.all(
    globSync(filePattern, { cwd: formattedRouteFolder }).map(async (path) => {
      const fileContent = await readFile(
        `${formattedRouteFolder}/${path}`,
        "utf-8"
      )

      await writeFile(
        `${formattedOutputFolder}/${path}`,
        fileContent.replace(
          "@root/dist/demo/schemas",
          `${path
            .split("/")
            .map(() => "..")
            .join("/")}/demo/schemas`
        )
      ),
        "utf-8"
    })
  )
}
function prepareApiDefinitionConfig(routeFolder) {
  const filePattern = "**/@(*.js|*.ts)"
  return Promise.all(
    globSync(filePattern, { cwd: routeFolder })
      .filter((path) =>
        ["head", "options", "get", "post", "put", "patch", "delete"].includes(
          basename(path, extname(path)).toLowerCase()
        )
      )
      .map(async (path) => ({
        path,
        fullFilePath: `${routeFolder}/${path}`,
        apiPath: `/${path
          .replace(basename(path), "")
          .replace(/_/g, ":")
          .replace(/\/$/, "")}`,
        apiMethod: basename(path, extname(path)).toLowerCase(),
      }))
  )
}
function formatApiDefinitions(apiDefinitionConfigs) {
  return Promise.all(apiDefinitionConfigs.map(extractApiDefinition))
}
async function extractApiDefinition(config) {
  const program = ts.createProgram({
    rootNames: [config.fullFilePath],
    options: {
      allowJs: true,
    },
  })
  const tsSourceFile = program.getSourceFile(config.fullFilePath)
  return collectVariableAndFunctionDefinition(tsSourceFile, config)
}
function collectVariableAndFunctionDefinition(sourceFile, config) {
  if (!sourceFile) {
    return
  }
  const apiDefinition = collectApiDefinition(sourceFile)
  const variables = collectVariableDefinitions(sourceFile, config)
  const formattedApiDefinition = formatApiDefinition(
    sourceFile,
    apiDefinition,
    variables
  )
  return formatVariableAndFunctionDefinition(
    formattedApiDefinition,
    variables,
    config
  )
}
function collectApiDefinition(sourceFile) {
  let apiDefinition = {}
  sourceFile.statements.forEach((node) => {
    if (ts.isVariableStatement(node)) {
      const declaration = node.declarationList.declarations[0]
      const declarationName = declaration.name.getText(sourceFile)
      if (
        ts.isIdentifier(declaration.name) &&
        declarationName === "apiDefinition"
      ) {
        const initializer = declaration?.initializer
        if (ts.isObjectLiteralExpression(initializer)) {
          initializer?.properties.forEach((property) => {
            if (
              ts.isPropertyAssignment(property) &&
              ts.isIdentifier(property.name)
            ) {
              apiDefinition[property.name.getText(sourceFile)] =
                property.initializer
            }
          })
        }
      }
    }
  })
  return apiDefinition
}
function extractExtraVariableString(apiDefinitions) {
  return apiDefinitions
    .filter((definition) => !!definition)
    .map((definition) => definition?.extraVariables.join("\n"))
    .join("\n")
}
function collectVariableDefinitions(sourceFile, config) {
  const printer = ts.createPrinter()
  const variablePrefix = `_${config.apiPath.replace(/[\/:-]/g, "_")}__${
    config.apiMethod
  }__`
  let definitions = {}
  sourceFile.statements.forEach((node) => {
    if (ts.isVariableStatement(node)) {
      const declaration = node.declarationList.declarations[0]
      const declarationName = declaration.name.getText(sourceFile)
      if (
        ts.isIdentifier(declaration.name) &&
        declarationName !== "apiDefinition"
      ) {
        const newDeclarationName = `${variablePrefix}${declarationName}`
        const newDeclaration = ts.factory.createIdentifier(newDeclarationName)
        const updatedVariableDeclaration = ts.factory.updateVariableDeclaration(
          declaration,
          newDeclaration,
          declaration.exclamationToken,
          declaration.type,
          declaration.initializer
        )
        const updatedVariableDeclarationList =
          ts.factory.updateVariableDeclarationList(node.declarationList, [
            updatedVariableDeclaration,
          ])
        const updatedVariableStatement = ts.factory.updateVariableStatement(
          node,
          node.modifiers,
          updatedVariableDeclarationList
        )
        definitions[declarationName] = {
          name: newDeclarationName,
          text: printer.printNode(
            ts.EmitHint.Unspecified,
            updatedVariableStatement,
            sourceFile
          ),
          used: false,
        }
      }
    }
    if (
      ts.isFunctionDeclaration(node) &&
      node.name &&
      ts.isIdentifier(node.name)
    ) {
      const declarationName = node.name.getText(sourceFile)
      const newDeclarationName = `${variablePrefix}${declarationName}`
      const newDeclaration = ts.factory.createIdentifier(newDeclarationName)
      const updatedFunctionDeclaration = ts.factory.updateFunctionDeclaration(
        node,
        node.modifiers,
        node.asteriskToken,
        newDeclaration,
        node.typeParameters,
        node.parameters,
        node.type,
        node.body
      )
      definitions[declarationName] = {
        name: newDeclarationName,
        text: printer.printNode(
          ts.EmitHint.Unspecified,
          updatedFunctionDeclaration,
          sourceFile
        ),
        used: false,
      }
    }
  })
  Object.keys(definitions).forEach((key) => {
    definitions[key] = replaceCustomVariableNamesInVariableDefinition(
      sourceFile,
      definitions[key],
      definitions
    )
  })
  return definitions
}
function replaceCustomVariableNamesInVariableDefinition(
  sourceFile,
  definition,
  variables
) {
  let usedVariables = []
  const printer = ts.createPrinter()
  const variableFile = ts.createSourceFile(
    "variables.ts",
    definition.text,
    ts.ScriptTarget.Latest
  )
  const result = ts.transform(variableFile, [
    traverseVariableDefinition(variableFile, variables, usedVariables),
  ]).transformed[0]
  return {
    ...definition,
    usedVariables,
    text: printer.printNode(ts.EmitHint.Unspecified, result, variableFile),
  }
}
function traverseVariableDefinition(sourceFile, variables, usedVariables) {
  return (context) => (rootNode) => {
    function visit(node) {
      if (ts.isIdentifier(node)) {
        const variableName = node.getText(sourceFile)
        if (variables[variableName]) {
          usedVariables.push(variableName)
          return ts.factory.createIdentifier(variables[variableName].name)
        }
      }
      if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.initializer)) {
        const variableName = node.initializer.getText(sourceFile)
        if (variables[variableName]) {
          usedVariables.push(variableName)
          const updatedInitializer = ts.factory.createIdentifier(
            variables[variableName].name
          )
          return ts.factory.updatePropertyAssignment(
            node,
            node.name,
            updatedInitializer
          )
        }
      }
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const variableName = node.expression.getText(sourceFile)
        if (variables[variableName]) {
          usedVariables.push(variableName)
          const updatedExpression = ts.factory.createIdentifier(
            variables[variableName].name
          )
          return ts.factory.updateCallExpression(
            node,
            updatedExpression,
            node.typeArguments,
            node.arguments
          )
        }
      }
      if (
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression)
      ) {
        const variableName = node.expression.getText(sourceFile)
        if (variables[variableName]) {
          usedVariables.push(variableName)
          const updatedExpression = ts.factory.createIdentifier(
            variables[variableName].name
          )
          return ts.factory.updatePropertyAccessExpression(
            node,
            updatedExpression,
            node.name
          )
        }
      }
      if (
        ts.isElementAccessExpression(node) &&
        ts.isIdentifier(node.expression)
      ) {
        const variableName = node.expression.getText(sourceFile)
        if (variables[variableName]) {
          usedVariables.push(variableName)
          const updatedExpression = ts.factory.createIdentifier(
            variables[variableName].name
          )
          return ts.factory.updateElementAccessExpression(
            node,
            updatedExpression,
            node.argumentExpression
          )
        }
      }
      return ts.visitEachChild(node, visit, context)
    }
    return ts.visitNode(rootNode, visit)
  }
}
function formatApiDefinition(sourceFile, apiDefinition, variables) {
  const definition = {}
  Object.keys(apiDefinition).forEach((key) => {
    if (key === "errorStatuses") {
      const statuses = JSON.parse(apiDefinition[key].getText(sourceFile)) || []
      definition["errors"] = `[${statuses
        .map((status) => `ResponseSchemas[${status}]`)
        .join(",")}]`
    } else {
      definition[key] = replaceCustomVariableNamesInDefinition(
        sourceFile,
        apiDefinition[key],
        variables
      )
    }
  })
  return definition
}
function replaceCustomVariableNamesInDefinition(sourceFile, node, variables) {
  if (ts.isStringLiteral(node)) {
    return node.text
  }
  const printer = ts.createPrinter()
  const identifierFile = ts.createSourceFile(
    "identifier.ts",
    node.getText(sourceFile),
    ts.ScriptTarget.Latest
  )
  const result = ts.transform(identifierFile, [
    traverseDefinition(identifierFile, variables),
  ]).transformed[0]
  return printer
    .printNode(ts.EmitHint.Unspecified, result, identifierFile)
    .replace(/(\\n)|\s|;/g, "")
}
function traverseDefinition(sourceFile, variables) {
  return (context) => (rootNode) => {
    function visit(node) {
      if (ts.isIdentifier(node)) {
        const variableName = node.getText(sourceFile)
        if (variables[variableName]) {
          markUsedVariableInDefinition(variables, variableName)
          return ts.factory.createIdentifier(variables[variableName].name)
        }
      }
      if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.initializer)) {
        const variableName = node.initializer.getText(sourceFile)
        if (variables[variableName]) {
          markUsedVariableInDefinition(variables, variableName)
          const updatedInitializer = ts.factory.createIdentifier(
            variables[variableName].name
          )
          return ts.factory.updatePropertyAssignment(
            node,
            node.name,
            updatedInitializer
          )
        }
      }
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const variableName = node.expression.getText(sourceFile)
        if (variables[variableName]) {
          markUsedVariableInDefinition(variables, variableName)
          const updatedExpression = ts.factory.createIdentifier(
            variables[variableName].name
          )
          return ts.factory.updateCallExpression(
            node,
            updatedExpression,
            node.typeArguments,
            node.arguments
          )
        }
      }
      if (
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression)
      ) {
        const variableName = node.expression.getText(sourceFile)
        if (variables[variableName]) {
          markUsedVariableInDefinition(variables, variableName)
          const updatedExpression = ts.factory.createIdentifier(
            variables[variableName].name
          )
          return ts.factory.updatePropertyAccessExpression(
            node,
            updatedExpression,
            node.name
          )
        }
      }
      if (
        ts.isElementAccessExpression(node) &&
        ts.isIdentifier(node.expression)
      ) {
        const variableName = node.expression.getText(sourceFile)
        if (variables[variableName]) {
          markUsedVariableInDefinition(variables, variableName)
          const updatedExpression = ts.factory.createIdentifier(
            variables[variableName].name
          )
          return ts.factory.updateElementAccessExpression(
            node,
            updatedExpression,
            node.argumentExpression
          )
        }
      }
      return ts.visitEachChild(node, visit, context)
    }
    return ts.visitNode(rootNode, visit)
  }
}
function markUsedVariableInDefinition(variables, variableName) {
  variables[variableName].used = true
  variables[variableName].usedVariables.forEach(
    (variable) => (variables[variable].used = true)
  )
}
function formatVariableAndFunctionDefinition(apiDefinition, variables, config) {
  return {
    apiDefinition: JSON.stringify({
      ...apiDefinition,
      method: config.apiMethod,
      path: config.apiPath,
      parameters: "parameterPlaceholder",
      response: "responsePlaceholder",
      errors: "errorsPlaceholder",
    })
      .replace('"parameterPlaceholder"', apiDefinition.parameters || "[]")
      .replace(
        '"responsePlaceholder"',
        apiDefinition.response || "z.object({}).optional()"
      )
      .replace('"errorsPlaceholder"', apiDefinition.errors || "[]"),
    extraVariables: Object.keys(variables)
      .filter((key) => variables[key].used)
      .map((key) => variables[key].text),
  }
}
function extractApiDefinitionString(apiDefinitions) {
  return apiDefinitions
    .filter((definition) => !!definition)
    .map((definition) => definition?.apiDefinition)
    .join(",")
}
