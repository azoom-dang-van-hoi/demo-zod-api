import { OrganizationSchema } from "@root/dist/demo/schemas"

export const CreateOrganizationSchemaBody = OrganizationSchema.omit({
  id: true,
  createdDatetime: true,
  updatedDatetime: true,
})

export { OrganizationSchema }
