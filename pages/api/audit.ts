import { Api } from 'sst/node/api'

export default async function handler(req, res) {
  const results = await fetch(Api.api.url)

  res.send({
    data: await results.json(),
  })
}
