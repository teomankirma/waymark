import { useEffect, useRef, useState } from 'react'

export function AccountFrame({ memberId }: { memberId: string }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(380)
  const src = `/account-panel/${encodeURIComponent(memberId)}`

  useEffect(() => {
    const element = frame.current

    if (!element) {
      return
    }

    let observer: ResizeObserver | undefined

    function observeContent() {
      observer?.disconnect()

      const content = element?.contentDocument?.body

      if (!content) {
        return
      }

      const resize = () =>
        setHeight(Math.ceil(content.getBoundingClientRect().height) + 2)

      observer = new ResizeObserver(resize)
      observer.observe(content)
      resize()
    }

    element.addEventListener('load', observeContent)
    observeContent()

    return () => {
      element.removeEventListener('load', observeContent)
      observer?.disconnect()
    }
  }, [src])

  return (
    <iframe
      ref={frame}
      title="Savings account details"
      src={src}
      style={{ height }}
      className="w-full rounded-xl border bg-background shadow-sm"
    />
  )
}
