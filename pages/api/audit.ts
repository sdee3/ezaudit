export default async function handler(req, res) {
  const results = await fetch(process.env.NEXT_PUBLIC_LIGHTHOUSE_CRAWL_ROUTE)

  res.send({
    data: await results.json(),
  })
}
