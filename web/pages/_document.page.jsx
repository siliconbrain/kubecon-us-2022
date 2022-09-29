import Document, { Html, Head, Main, NextScript } from 'next/document'

export default class MyDocument extends Document {
  render() {
    return (
      <Html lang="en" className="scroll-smooth">
        <Head>
          <meta charSet="utf-8" />
          <base href="/" />
          <meta name="theme-color" content="#ffffff" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" />
          <link
            href="https://fonts.googleapis.com/css2?family=Cabin:wght@400;500;600;700&family=Nunito:wght@200;300;400&display=swap"
            rel="stylesheet"
          />
        </Head>
        <body className="bg-white font-sans text-black antialiased">
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}
