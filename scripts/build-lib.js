import {
  resolve,
  join,
  parse,
  dirname,
  relative,
  basename,
  extname,
} from "node:path"
import { promisify } from "node:util"
import { exec } from "node:child_process"
import { writeFile, readFile, readdir, stat } from "node:fs/promises"
const pExec = promisify(exec)

async function ensureOutputFolder(outputFolder) {
  await pExec(`rm -rf ${outputFolder} || true`)
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

async function copyFile(config) {
  const projectFolder = process.cwd()
  const target = resolve(projectFolder, "api-defination.js")
  const destination = resolve(config.outputFolder, "index.js")
  await copy(target, destination)
}

async function main() {
  const packageFile = JSON.parse(await readFile("package.json", "utf-8"))
  const publishVersion = packageFile.version

  const config = {
    outputFolder: "dist",
    publishName: "demo-zod-api",
    publishVersion,
    publishRepository: "git@github.com:azoom-dang-van-hoi/demo-zod-api.git",
  }
  await ensureOutputFolder(config.outputFolder)
  await generateLibPackageJsonFile(config)
  await copyFile(config)
}

main()
