import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="ko">
      <Head>
        <title>모란글샘 구입희망도서 신청</title>
        <meta name="description" content="부개여고 모란글샘 구입희망도서 신청" />
    <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"
        />
      <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Gugi&display=swap"
        />
      <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Single+Day&display=swap"
        />       
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
