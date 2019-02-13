# Exception middleware for koa

## install

```
npm i @gem-mine/exception -S
```

## useage

正常使用 koa 的中间件：

```js
app.use(exception({
  /**
   * 是否开启调试模式，显示更丰富的错误堆栈等信息
   */
  debug?: boolean
  /**
   * 写入日志处理
   */
  logger?: function(data:Exception):void
  /**
   * 自定义处理
   */
  custom?: function(data:Exception):void
}))
```

例子：

```js
export default exception({
  debug: process.env.NODE_ENV !== 'production'
})
```

```js
export default exception({
  debug: process.env.NODE_ENV !== 'production',
  custom: function(data, ctx) {
    if (ctx.status === 404) {
      return await ctx.render('404.html')
    }
    ctx.body = data
  }
})
```
