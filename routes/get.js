import z from "zod"
export const apiDefinition = {
  alias: "defaultGet",
  description: "Get default",
  response: z.object({ message: z.string() }),
  errorStatuses: [400, 403, 404, 500],
}
export default (req, res) => {
  res.sendStatus(200)
}
