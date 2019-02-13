import * as Koa from 'koa'
import { parseCookie, parseException } from './util'
import { IncomingHttpHeaders } from 'http'
import { StackFrame } from 'stack-trace'

interface Cookie {
  key: string
  value: string
}

export interface Exception {
  code: number
  httpVersion?: string
  method?: string
  url?: string
  message?: string
  connection?: string
  headers?: IncomingHttpHeaders
  cookies?: Cookie[]
  stack?: StackFrame[]
}

export interface OPTIONS {
  /**
   * 是否开启调试模式，显示更丰富的错误堆栈等信息
   */
  debug?: boolean
  /**
   * 写入日志处理
   */
  logger?: (data: Exception, ctx: Koa.Context) => void
  /**
   * 自定义处理异常，例如根据不同 HTTP 状态码返回不同页面等
   */
  custom?: (data: Exception, ctx: Koa.Context) => void
  /**
   * 默认异常提示语，默认值：unknown exception
   */
  defaultMessage?: string
}

function exception(options?: OPTIONS): (context: Koa.Context, next: () => Promise<any>) => void {
  return async function(ctx: Koa.Context, next: () => Promise<any>) {
    try {
      await next()
    } catch (e) {
      const code = e.httpCode || e.statusCode || 500
      const message = e.message || 'unknown exception'

      if (code > 600) {
        ctx.status = 500
      } else {
        ctx.status = code
      }
      const type = ctx.type
      if (type !== 'text/plain' && type !== 'text/html') {
        ctx.type = 'application/json'
      }

      let data: Exception = {
        code,
        message
      }

      if (options) {
        const { debug, custom, logger } = options
        if (debug) {
          console.error(e)
          const { req } = ctx
          const { headers } = req
          const cookies = parseCookie(headers.cookie)

          data = {
            code,
            httpVersion: req.httpVersion,
            method: req.method,
            url: req.url,
            message,
            connection: headers.connection,
            headers,
            cookies,
            stack: parseException(e)
          }
        }

        if (custom) {
          await custom(data, ctx)
        } else {
          ctx.body = data
        }
        if (logger) {
          logger(data, ctx)
        }
      } else {
        ctx.body = data
      }
    }
  }
}

export default exception
