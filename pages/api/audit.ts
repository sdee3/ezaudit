import { NextApiHandler } from 'next'

const handler: NextApiHandler = async (req, res) => {
  const response = await fetch(process.env.NEXT_PUBLIC_LIGHTHOUSE_CRAWL_ROUTE, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      url: req.body.url,
      email: req.body.email,
    },
  })

  const json = await response.json()

  res.send({
    data: json,
  })
}

export default handler
