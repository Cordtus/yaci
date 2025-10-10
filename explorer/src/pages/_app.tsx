import type { AppType } from 'next/app'
import { Inter } from 'next/font/google'
import { trpc } from '@/lib/utils/trpc.js'
import '@/styles/globals.css'

const inter = Inter({ subsets: ['latin'] })

const MyApp: AppType = ({ Component, pageProps }) => {
  return (
    <div className={inter.className}>
      <Component {...pageProps} />
    </div>
  )
}

export default trpc.withTRPC(MyApp)