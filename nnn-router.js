import { EventEmitter } from 'events'
import * as glob from 'glob'
import express from 'express'
const router = express.Router()
const isWindows = process.platform === 'win32'

export default (options = {}) => {
  let temporary
  let isInitialized = false
  const emitter = new EventEmitter()
  const initializationEvent = 'initialized'
  return async (req, res, next) => {
    if (temporary) {
      if (isInitialized) return temporary(req, res, next)
      return emitter.once(initializationEvent, () => temporary(req, res, next))
    }
    temporary = typeof options.baseRouter === 'undefined' ? router : options.baseRouter
    const routeDir = 'routeDir' in options ? options.routeDir : '/routes'
    const filePattern = '**/@(*.js|*.ts)'

    const usePath =
      options.absolutePath === undefined
        ? process.cwd() + routeDir.replace('./', '/')
        : options.absolutePath


    const pathObj = glob
      .sync(filePattern, { cwd: usePath })
      .reduce((obj, path) => {
        try {
          if (throwerror(path).toString() == [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1].toString()) {
            throw new Error('invalid filename use HTTP method')
          }
        } catch (error) {
          console.error('ERROR: ', error)
        }

        const cut = '/' + path.replace('.js', '').replace('.ts', '').replace(/_/g, ':')
        const result = cut.split('/').slice(0, -1).join('/')
        const apiPath = result === '' ? '/' : result
        obj[usePath + '/' + path] = apiPath
        return obj
      }, {})

    // Descending sort for exception handling at dynamic routes
    const sortedPaths = Object.entries(pathObj).sort((a, b) => (a < b ? 1 : -1))
    // Sort middleware to the top of the array
    const middlewareSort = sortedPaths
      .filter(a => a[0].slice(a[0].lastIndexOf('/') + 1).slice(0, 'middleware'.length) === 'middleware')
      .concat(
        sortedPaths.filter(a => a[0].slice(a[0].lastIndexOf('/') + 1).slice(0, 'middleware'.length) !== 'middleware')
      )

    for (let i = 0; i < middlewareSort.length; i++) {
      const [filePath, routePath] = middlewareSort[i]
      const methodName = filePath
        .split('/')
        .slice(-1)[0]
        .replace('.js', '')
        .replace('.ts', '')
      const method = methodName === 'middleware' ? 'use' : methodName

      const handler = await import((isWindows ? 'file://' : '') + filePath)

      if (typeof handler.middleware === 'object') {
        temporary[method](routePath, ...Object.values(handler.middleware).filter(v => typeof v === 'function').map(v => wrapMiddleware(v)))
      } else if (typeof handler.middleware === 'function') {
        temporary[method](routePath, wrapMiddleware(handler.middleware))
      }

      if (typeof handler === 'function') {
        temporary[method](routePath, wrapMiddleware(handler))
      } else if (typeof handler.default === 'function') {
        temporary[method](routePath, wrapMiddleware(handler.default))
      }
    }

    isInitialized = true
    emitter.emit(initializationEvent)
    return temporary(req, res, next)
  }
}

const reqmethods = [
  'get',
  'head',
  'post',
  'put',
  'delete',
  'connnect',
  'options',
  'trace',
  'patch',
  'middleware',
]
const wrapMiddleware =
  fn =>
  (...args) =>
    Promise.resolve(fn(...args)).catch(args[2])

const throwerror = path => {
  return reqmethods.map(method => {
    return path.indexOf(method)
  })
}
