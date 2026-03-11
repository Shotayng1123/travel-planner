import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "旅のコンシェルジュ — Travel Planner",
  description: "格安フライトとホテルをまとめて検索",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
