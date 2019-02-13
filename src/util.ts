import cookie = require('cookie')
import path = require('path')
import fs = require('fs')
import stackTrace = require('stack-trace')

declare module 'stack-trace' {
  interface StackFrame {
    context: any
  }
}

const LN = 5

export function isNode(frame: stackTrace.StackFrame) {
  if (frame.isNative()) {
    return true
  }
  const filename = frame.getFileName() || ''
  return !path.isAbsolute(filename) && filename[0] !== '.'
}

export function getFrameSource(frame: stackTrace.StackFrame, maps: Map<string, string>) {
  const filename = frame.getFileName()
  const lineNumber = frame.getLineNumber()
  let contents = maps.get(filename)
  if (!contents) {
    contents = fs.readFileSync(filename, 'utf8')
    maps.set(filename, contents)
  }
  const lines = contents.split(/\r?\n/)

  return {
    pre: lines.slice(Math.max(0, lineNumber - (LN + 1)), lineNumber - 1),
    line: lines[lineNumber - 1],
    post: lines.slice(lineNumber, lineNumber + LN)
  }
}

export function parseException(exception: Error) {
  const stack = stackTrace.parse(exception)
  const maps = new Map()
  return stack.map(frame => {
    if (!isNode(frame)) {
      frame.context = getFrameSource(frame, maps)
    }
    return frame
  })
}

export function parseCookie(cookies?: string) {
  const parsedCookies = cookie.parse(cookies || '')
  return Object.keys(parsedCookies).map(key => {
    return { key, value: parsedCookies[key] }
  })
}
