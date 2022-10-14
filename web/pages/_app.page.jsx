import Head from 'next/head'
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
      <div className="absolute inset-0">
        <Component {...pageProps} />
      </div>
    </>
  )
}
