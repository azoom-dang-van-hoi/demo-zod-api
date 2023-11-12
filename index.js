import express from "express"
import promiseRouter from "express-promise-router"
import nnnRouter from "@azoom/nnn-router"
import cors from "cors"
import statuses from "statuses"

// Customize express response
express.response.sendStatus = function (statusCode) {
  const body = { message: statuses(statusCode) || String(statusCode) }
  this.statusCode = statusCode
  this.type("json")
  this.send(body)
}

const app = express()

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
  /* Add express.json and express.urlencoded to parse bodies
    https://github.com/expressjs/express/releases/tag/4.16.0 */
  express.urlencoded({ extended: true, limit: "50mb" }),
  express.json({ limit: "50mb" }),
  express.text({ limit: "10mb" })
)
app.use(
  // OpenApiValidator.middleware({
  //   apiSpec: './reference/openapi.yaml',
  //   validateRequests: {
  //     removeAdditional: 'all',
  //     coerceTypes: true,
  //   },
  //   validateResponses: true,
  // }),
  nnnRouter({ routeDir: "/routes", baseRouter: promiseRouter() })
)

const port = process.env.PORT || 5000
app.listen(port, () => {
  console.log(`Listening on port ${port}`)
})
