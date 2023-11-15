import { OrganizationSchema, CreateOrganizationSchemaBody } from "@zod-schema"
export const apiDefinition = {
  alias: "createOrganization",
  description: "Create organization",
  parameters: [
    {
      name: "organization",
      type: "Body",
      description: "Organization infor",
      schema: CreateOrganizationSchemaBody,
    },
  ],
  response: OrganizationSchema,
  errorStatuses: [400, 403, 404, 500],
}
export default (req, res) => {
  return res.send({
    id: Math.floor(Math.random() * 1000000),
    ...req.body,
  })
}
