import { useEffect } from 'react'

export type HeadMeta = {
  name?: string
  property?: string
  content: string
}

export function Head({
  title,
  meta = [],
}: {
  title: string
  meta?: HeadMeta[]
}) {
  const metaKey = JSON.stringify(meta)

  useEffect(() => {
    const previous = document.title
    document.title = title
    const created: HTMLMetaElement[] = []

    for (const tag of JSON.parse(metaKey) as HeadMeta[]) {
      const el = document.createElement('meta')
      if (tag.name) el.setAttribute('name', tag.name)
      if (tag.property) el.setAttribute('property', tag.property)
      el.setAttribute('content', tag.content)
      el.dataset.ezHead = ''
      document.head.appendChild(el)
      created.push(el)
    }

    return () => {
      document.title = previous
      created.forEach(el => el.remove())
    }
  }, [title, metaKey])

  return null
}
