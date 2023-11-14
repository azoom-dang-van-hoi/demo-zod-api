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
generateApiDefinitionFile({ outputFolder: "dist", routeFolder: "routes" })
export async function generateApiDefinitionFile(config) {
  const { outputFolder, routeFolder } = config
  const apiDefinitionConfigs = await prepareApiDefinitionConfig(routeFolder)
  const apiDefinitions = await formatApiDefinitions(apiDefinitionConfigs)
  const apiDefinitionString = extractApiDefinitionString(apiDefinitions)
  const extraVariableString = extractExtraVariableString(apiDefinitions)
  const apiDefinitionFilePath = resolve(outputFolder, "index.ts")
  await writeFile('dist/api-definition.js', `
import { makeErrors, makeApi } from "@zodios/core"
import { UserSchema } from "./demo/schemas"
import z from "zod"
export const apiClient = makeApi([${apiDefinitionString}])
`, 'utf8')
//   console.log(apiDefinitionString)
  //   await writeApiDefinitionFileContent({
  //     apiDefinitionString,
  //     extraVariableString,
  //     apiDefinitionFilePath,
  //     config,
  //   })
  //   await transpileToJs(apiDefinitionFilePath)
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
