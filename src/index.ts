import * as Koa from 'koa'
import { IncomingHttpHeaders } from 'http'
import { StackFrame, parse } from 'stack-trace'
import cookie = require('cookie')

interface Cookie {
  key: string
  value: string
}

export interface Exception {
  code: number
  message: string
  httpVersion?: string
  method?: string
  url?: string
  connection?: string
  headers?: IncomingHttpHeaders
  cookies?: Cookie[]
  stack?: StackFrame[]
}

export interface OPTIONS {
  /**
   * 是否开启调试模式，显示更丰富的错误堆栈等信息，同时会将错误信息打印在控制台，生产环境请勿开启
   */
  debug?: boolean
  /**
   * 写入日志处理
   */
  logger?: (data: Exception, ctx: Koa.Context, error: Error) => void
  /**
   * 自定义处理异常，例如根据不同 HTTP 状态码返回不同页面等
   */
  custom?: (data: Exception, ctx: Koa.Context, error: Error) => void
  /**
   * 默认异常提示语，默认值：unknown exception
   */
  defaultMessage?: string
  /**
   * 404页面，当非 json 请求遇到 404 时的返回页面
   */
  notFoundPage?: string
}

function parseCookie(cookies?: string) {
  const parsedCookies = cookie.parse(cookies || '')
  return Object.keys(parsedCookies).map(key => {
    return { key, value: parsedCookies[key] }
  })
}

let _init = true

function parseError(ctx: Koa.Context, e: any, options?: OPTIONS): Exception {
  const code = e.httpCode || e.statusCode || 500
  let message = e.message
  if (!message) {
    if (options && options.defaultMessage) {
      message = options.defaultMessage
    } else {
      message = 'unknown exception'
    }
  }

  const { req } = ctx
  const { headers, url, method, httpVersion } = req
  const cookies = parseCookie(headers.cookie)

  const data: Exception = {
    code,
    message,
    method,
    url,
    headers,
    cookies,
    httpVersion,
    connection: headers.connection,
    stack: parse(e)
  }

  if (options) {
    const { debug } = options
    if (debug) {
      console.error(data)
    }
  }

  return data
}

function exception(options?: OPTIONS): (context: Koa.Context, next: () => Promise<any>) => void {
  return async function(ctx: Koa.Context, next: () => Promise<any>) {
    try {
      if (_init) {
        _init = false

        ctx.app.on('error', e => {
          if (options) {
            const { logger } = options
            if (logger) {
              const data = parseError(ctx, e, options)
              logger(data, ctx, e)
            }
          }
        })
      }

      await next()
      // 404 处理，将 404 也作为异常统一抛出
      if (ctx.status === 404) {
        ctx.throw(404, '404 not found')
      }
    } catch (e) {
      const data = parseError(ctx, e, options)
      const { code, message } = data

      const { accept } = ctx.headers
      ctx.acceptJSON = true
      const notFoundError = code === 404
      if (<string>accept) {
        if (accept.indexOf('text/html') > -1) {
          ctx.type = 'text/html'
          ctx.acceptJSON = false
        } else {
          ctx.type = 'application/json'
        }
      }

      if (options) {
        const { debug, custom, logger, notFoundPage } = options
        let response: Exception
        if (debug) {
          response = data
        } else {
          response = { code, message }
        }
        if (custom) {
          await custom(response, ctx, e)
        } else {
          if (notFoundError && notFoundPage && !ctx.acceptJSON && ctx.render) {
            ctx.render(notFoundPage)
            ctx.status = 404
            return
          }

          ctx.body = response
        }
        if (logger) {
          setTimeout(() => {
            logger(data, ctx, e)
          }, 0)
        }
      } else {
        ctx.body = { code, message }
      }
      if (code > 600) {
        ctx.status = 500
      } else {
        ctx.status = code
      }
    }
  }
}

export default exception
