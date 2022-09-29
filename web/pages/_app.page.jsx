import Head from 'next/head'
import Script from 'next/script'
import './globals.css'

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>KubeCon | 2022</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=yes, viewport-fit=cover"
        />
      </Head>
      <div className="absolute inset-0 flex flex-col">
        <div className="flex flex-1">
          <div className="flex-1 bg-gray-50 dark:bg-gray-900">
            <Component {...pageProps} />
          </div>
        </div>
      </div>
    </>
  )
}
