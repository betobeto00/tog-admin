import { useEffect, useState } from 'react'
import { getApi } from '../lib/api-client'

interface Props {
  productoId: number
  alt?: string
  className?: string
  fallbackSrc?: string | null
}

export default function ProductImage({ productoId, alt = '', className, fallbackSrc }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    setDataUrl(null)
    setLoaded(false)
    getApi()
      .productos.getImagen({ id: productoId })
      .then((res: { success?: boolean; dataUrl?: string | null }) => {
        if (!active) return
        if (res?.success && res.dataUrl) {
          setDataUrl(res.dataUrl)
        }
        setLoaded(true)
      })
      .catch(() => {
        if (active) setLoaded(true)
      })
    return () => {
      active = false
    }
  }, [productoId])

  const src = dataUrl || fallbackSrc

  if (!loaded && !fallbackSrc) {
    return <div className={`${className || 'w-10 h-10'} bg-gray-100 rounded-lg animate-pulse`} />
  }

  if (!src) {
    return (
      <div className={`${className || 'w-10 h-10'} bg-gray-100 rounded-lg flex items-center justify-center text-gray-400`}>
        <svg className="w-1/2 h-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
      </div>
    )
  }

  return <img src={src} alt={alt} className={`${className || 'w-10 h-10'} object-cover rounded-lg border border-gray-200`} />
}