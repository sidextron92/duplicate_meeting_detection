import type { Metadata } from "next";
import { Maven_Pro, Geist_Mono } from "next/font/google";
import "./globals.css";

const mavenPro = Maven_Pro({
  variable: "--font-maven-pro",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fraud Detection Dashboard",
  description: "Detect duplicate retailer accounts using GPS clustering",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${mavenPro.variable} ${geistMono.variable} antialiased dark`}
        style={{ fontFamily: "var(--font-maven-pro), sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
